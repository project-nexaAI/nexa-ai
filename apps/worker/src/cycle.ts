import { and, count, desc, eq, inArray, lte } from 'drizzle-orm'
import type { Address, Hex } from 'viem'
import { costLog, postQueue, predictions } from '@nexa-ai/db'
import { computePredictionHash, DIRECTION, type Direction } from '@nexa-ai/shared'
import { PERSONA_SYSTEM, buildPredictionPrompt, candidateFacts, type PredictionCandidate } from '../prompts/persona'
import { z } from 'zod'
import { decryptJson, encryptJson, randomSalt } from './crypto'
import type { LedgerClient } from './ledger'
import { generateStructured, type LlmClient, type Usage } from './llm'
import { mirrorToBackup, type Notifier } from './telegram'
import { XApiError, type XClient } from './x'
import { PipelineError, dueForPublish, enqueuePost, type Db, type EnqueueResult, type PostMode } from './queue'

export const PREDICTION_HORIZON_SECONDS = 7 * 24 * 3600

export interface CycleDeps {
  db: Db
  ledger: LedgerClient
  /** Kunci 32 byte hex untuk mengenkripsi preimage (env PREIMAGE_KEY). */
  encKey: string
  mode: PostMode
  /** Kanal cadangan publik (Telegram); dipakai bersamaan dengan post publik. Opsional. */
  backup?: Notifier
  /** Kebijakan penerbitan ke X. Tanpa ini post bermode live tidak pernah terbit (dry tetap jalan). */
  publish?: PublishPolicy
}

export interface PublishPolicy {
  x: XClient
  /** Batas jumlah post live sepanjang masa di database ini; 0 = tidak ada post live. Setelah tercapai, penerbit berhenti sendiri. */
  liveCap: number
  /** Jeda minimum antar post live (ms), mis. 30 menit. */
  minGapMs: number
  /** Jenis post (kind) yang boleh keluar ke X; kosong/tidak diisi = semua. */
  kinds?: string[]
}

interface Preimage {
  text: string
  asset: Address
  direction: Direction
  horizon: number
  salt: Hex
  /** Fakta tool result untuk pemeriksaan angka RiskGuard (bukan bagian dari hash). */
  facts?: string[]
}

// ----------------------------------------------------------------------- biaya

export async function recordLlmCosts(db: Db, usages: Usage[]): Promise<void> {
  if (usages.length === 0) return
  await db.insert(costLog).values(
    usages.map((u) => ({
      category: 'llm' as const,
      ref: u.model,
      tokensIn: u.tokensIn,
      tokensOut: u.tokensOut,
      usdMicros: u.usdMicros,
    })),
  )
}

// -------------------------------------------------------------------- generate

const draftSchema = z.object({
  symbol: z.string(),
  direction: z.enum(['up', 'down']),
  text: z.string().min(10).max(280),
})

export class NoDataError extends PipelineError {}

/** LLM memilih satu aset dari data oracle. Tanpa data: tidak ada prediksi (jawab "tidak tahu"). */
export async function generatePredictionDraft(llm: LlmClient, db: Db, candidates: readonly PredictionCandidate[]) {
  if (candidates.length === 0) throw new NoDataError('tidak ada data oracle; tidak ada prediksi hari ini')
  const { value, usages } = await generateStructured(llm, draftSchema, {
    tier: 'small',
    system: PERSONA_SYSTEM,
    user: buildPredictionPrompt(candidates, PREDICTION_HORIZON_SECONDS / 86400),
  })
  await recordLlmCosts(db, usages)
  const chosen = candidates.find((c) => c.symbol === value.symbol)
  if (!chosen) throw new PipelineError(`LLM memilih simbol di luar data: ${value.symbol}`)
  return {
    asset: chosen.asset,
    direction: DIRECTION[value.direction === 'up' ? 'UP' : 'DOWN'],
    text: value.text,
    facts: candidateFacts(chosen, PREDICTION_HORIZON_SECONDS / 86400),
  }
}

// ----------------------------------------------------------------------- draft

/** Simpan prediksi sebagai draft. Salt acak dibuat di sini dan hanya disimpan terenkripsi. */
export async function draftPrediction(
  deps: CycleDeps,
  p: { text: string; asset: Address; direction: Direction; horizon?: number; facts?: string[] },
): Promise<{ id: number; hash: Hex }> {
  const preimage: Preimage = {
    text: p.text,
    asset: p.asset,
    direction: p.direction,
    horizon: p.horizon ?? PREDICTION_HORIZON_SECONDS,
    salt: randomSalt(),
    ...(p.facts ? { facts: p.facts } : {}),
  }
  const hash = computePredictionHash(preimage)
  const [row] = await deps.db
    .insert(predictions)
    .values({ hash, preimageEncrypted: encryptJson(deps.encKey, preimage), status: 'draft' })
    .returning({ id: predictions.id })
  return { id: row!.id, hash }
}

// ---------------------------------------------------------------------- commit

/** commit(hash) on-chain; status menjadi 'committed' hanya setelah tx terkonfirmasi dan tx hash tersimpan. */
export async function commitPrediction(deps: CycleDeps, id: number): Promise<void> {
  const [pred] = await deps.db.select().from(predictions).where(eq(predictions.id, id))
  if (!pred) throw new PipelineError(`prediksi ${id} tidak ada`)
  if (pred.status !== 'draft') throw new PipelineError(`prediksi ${id} sudah berstatus ${pred.status}`)
  const preimage = decryptJson<Preimage>(deps.encKey, pred.preimageEncrypted)

  const res = await deps.ledger.commit(pred.hash as Hex)
  await deps.db
    .update(predictions)
    .set({
      status: 'committed',
      ledgerId: res.ledgerId,
      commitTxHash: res.txHash,
      committedAt: new Date(Number(res.committedAt) * 1000),
      maturesAt: new Date(Number(res.committedAt + BigInt(preimage.horizon)) * 1000),
    })
    .where(eq(predictions.id, id))
}

// ---------------------------------------------------------------------- antrian

/** Masukkan teks prediksi ke antrian (RiskGuard + cek commit dilakukan di enqueuePost). */
export async function queuePredictionPost(deps: CycleDeps, id: number): Promise<EnqueueResult> {
  const [pred] = await deps.db.select().from(predictions).where(eq(predictions.id, id))
  if (!pred) throw new PipelineError(`prediksi ${id} tidak ada`)
  const { text, facts } = decryptJson<Preimage>(deps.encKey, pred.preimageEncrypted)
  return enqueuePost(deps.db, {
    kind: 'prediction',
    mode: deps.mode,
    predictionId: id,
    input: { type: 'prediction', text, tokens: [], dataComplete: true, ...(facts ? { facts } : {}) },
  })
}

// --------------------------------------------------------------------- publisher

/** Biaya X API per post tanpa link (brief): ~$0,015. */
const X_POST_COST_USD_MICROS = 15_000n

/**
 * Menerbitkan post yang sudah disetujui dan lewat jadwal.
 * Mode dry: hanya log + tandai posted. Mode live: hanya bila kebijakan penerbitan ada dan semua pengaman lolos:
 * jumlah post live belum mencapai batas (`liveCap`), jeda minimum antar post terpenuhi, dan jenis post diizinkan.
 * Post "diklaim" (status posted) SEBELUM dikirim ke X, supaya restart atau proses ganda tidak pernah mengirim dua kali.
 */
export async function publishDue(deps: CycleDeps, now = new Date()): Promise<number[]> {
  const due = await dueForPublish(deps.db, now)
  const published: number[] = []
  for (const post of due) {
    if (post.mode === 'live') {
      const policy = deps.publish
      if (!policy) continue // tanpa kredensial X: post live menunggu, tidak membuat siklus gagal
      if (policy.kinds && policy.kinds.length > 0 && !policy.kinds.includes(post.kind)) continue
      const livePosted = await deps.db.select({ n: count() }).from(postQueue).where(and(eq(postQueue.mode, 'live'), eq(postQueue.status, 'posted')))
      if (Number(livePosted[0]?.n ?? 0) >= policy.liveCap) break // batas tercapai: penerbit berhenti sampai batas dinaikkan
      const [last] = await deps.db
        .select({ at: postQueue.postedAt })
        .from(postQueue)
        .where(and(eq(postQueue.mode, 'live'), eq(postQueue.status, 'posted')))
        .orderBy(desc(postQueue.postedAt))
        .limit(1)
      if (last?.at && now.getTime() - last.at.getTime() < policy.minGapMs) break

      const claimed = await deps.db
        .update(postQueue)
        .set({ status: 'posted', postedAt: now, externalId: 'claimed' })
        .where(and(eq(postQueue.id, post.id), eq(postQueue.status, 'approved')))
        .returning({ id: postQueue.id })
      if (claimed.length === 0) continue
      try {
        const sent = await policy.x.post(post.content, post.replyTo ? { replyTo: post.replyTo } : {})
        await deps.db.update(postQueue).set({ externalId: sent.id }).where(eq(postQueue.id, post.id))
        await deps.db.insert(costLog).values({ category: 'x_api', ref: 'post', usdMicros: X_POST_COST_USD_MICROS })
        console.log(`[x:live] post #${post.id} (${post.kind}) terbit: ${sent.id}`)
      } catch (err) {
        const retryable = err instanceof XApiError && err.retryable
        // Sementara: kembalikan ke antrian dan coba lagi siklus berikutnya. Permanen: tolak supaya tidak diulang terus.
        await deps.db
          .update(postQueue)
          .set(retryable ? { status: 'approved', postedAt: null, externalId: null } : { status: 'rejected', externalId: null })
          .where(eq(postQueue.id, post.id))
        console.error(`[x:live] post #${post.id} gagal${retryable ? ' (akan dicoba lagi)' : ' (ditolak, tidak diulang)'}: ${err instanceof Error ? err.message : String(err)}`)
        break
      }
    } else {
      console.log(`[x:dry] post #${post.id} (${post.kind}): ${post.content}`)
      await deps.db
        .update(postQueue)
        .set({ status: 'posted', postedAt: now, externalId: `dry-${post.id}` })
        .where(and(eq(postQueue.id, post.id), eq(postQueue.status, 'approved')))
      await deps.db.insert(costLog).values({ category: 'x_api', ref: 'post:dry', usdMicros: 0n })
    }
    if (post.predictionId !== null) {
      await deps.db
        .update(predictions)
        .set({ status: 'posted' })
        .where(and(eq(predictions.id, post.predictionId), eq(predictions.status, 'committed')))
    }
    await mirrorToBackup({ mode: post.mode, ...(deps.backup ? { notifier: deps.backup } : {}) }, post.content)
    published.push(post.id)
  }
  return published
}

// ------------------------------------------------------------------------ reveal

/** Reveal semua prediksi yang sudah jatuh tempo menurut waktu chain. Skor dihitung kontrak dari oracle. */
export async function revealMatured(deps: CycleDeps): Promise<number[]> {
  const nowChain = new Date(Number(await deps.ledger.chainTime()) * 1000)
  const rows = await deps.db
    .select()
    .from(predictions)
    .where(and(inArray(predictions.status, ['committed', 'posted']), lte(predictions.maturesAt, nowChain)))

  const revealed: number[] = []
  for (const pred of rows) {
    if (pred.ledgerId === null || !pred.committedAt || !pred.maturesAt) continue
    const pre = decryptJson<Preimage>(deps.encKey, pred.preimageEncrypted)
    const feed = await deps.ledger.feedOf(pre.asset)
    const rounds = await deps.ledger.findRounds(
      feed,
      BigInt(Math.floor(pred.committedAt.getTime() / 1000)),
      BigInt(Math.floor(pred.maturesAt.getTime() / 1000)),
    )
    const res = await deps.ledger.reveal({
      ledgerId: pred.ledgerId,
      text: pre.text,
      asset: pre.asset,
      direction: pre.direction,
      horizon: pre.horizon,
      salt: pre.salt,
      ...rounds,
    })
    await deps.db
      .update(predictions)
      .set({
        status: 'revealed',
        revealedText: pre.text,
        revealedAsset: pre.asset,
        revealedDirection: pre.direction,
        revealTxHash: res.txHash,
        revealedAt: new Date(),
        startRoundId: res.startRoundId.toString(),
        endRoundId: res.endRoundId.toString(),
        won: res.won,
        returnBps: Number(res.returnBps),
      })
      .where(eq(predictions.id, pred.id))
    revealed.push(pred.id)
  }
  return revealed
}
