import { desc, eq, gte } from 'drizzle-orm'
import { zeroAddress, type Address } from 'viem'
import { postQueue, predictions, riskguardLog } from '@nexa-ai/db'
import { evaluate, toLogEntry, type RiskGuardInput } from '@nexa-ai/riskguard'
import { NoDataError, commitPrediction, draftPrediction, generatePredictionDraft, queuePredictionPost, type CycleDeps } from './cycle'
import type { LlmClient } from './llm'
import { readOracleCandidates, type FeedReader, type OracleAsset } from './oracle'

export interface DailyConfig {
  /** Jam UTC paling awal Prediction of the Day dibuat (0-23). */
  hourUtc: number
  /** Aset yang boleh diprediksi; feed-nya dibaca dari NexaLedger (feedOf), jadi harus sudah didaftarkan di kontrak. */
  assets: readonly { symbol: string; asset: Address }[]
  /** Batas percobaan membuat draft per hari UTC (draft ditolak RiskGuard atau LLM gagal). */
  maxAttemptsPerDay: number
  /** Jeda minimum antar percobaan (ms), supaya kegagalan tidak membakar token LLM tiap siklus. */
  minRetryMs: number
}

export interface DailyState {
  day: string
  attempts: number
  lastAttemptAt: number
}

export interface DailyDeps {
  cycle: CycleDeps
  llm: LlmClient
  read: FeedReader
  cfg: DailyConfig
  state: DailyState
}

export type DailyStep = 'not_yet' | 'idle' | 'no_data' | 'blocked' | 'retry_later' | 'limit' | 'queued'

export const newDailyState = (): DailyState => ({ day: '', attempts: 0, lastAttemptAt: 0 })

/**
 * Satu Prediction of the Day per hari UTC. Idempoten per siklus (aman dipanggil tiap menit) dan urutannya mengikuti brief:
 * data oracle -> LLM -> RiskGuard -> commit terkonfirmasi -> antrian persetujuan. Draft hanya dibuat SETELAH lolos RiskGuard,
 * jadi tidak ada prediksi yang di-commit on-chain tetapi dilarang posting.
 */
export async function runDailyPrediction(d: DailyDeps, now = new Date()): Promise<DailyStep> {
  const { db } = d.cycle
  if (now.getUTCHours() < d.cfg.hourUtc) return 'not_yet'

  const day = now.toISOString().slice(0, 10)
  if (d.state.day !== day) Object.assign(d.state, { day, attempts: 0, lastAttemptAt: 0 })
  const dayStart = new Date(`${day}T00:00:00.000Z`)

  // Lanjutkan prediksi hari ini bila sudah ada (mis. proses mati setelah draft atau commit).
  const [today] = await db.select().from(predictions).where(gte(predictions.createdAt, dayStart)).orderBy(desc(predictions.createdAt)).limit(1)
  if (today) {
    if (today.status === 'draft') await commitPrediction(d.cycle, today.id)
    const [row] = await db.select().from(predictions).where(eq(predictions.id, today.id))
    if (row?.status === 'committed') {
      const [queued] = await db.select({ id: postQueue.id }).from(postQueue).where(eq(postQueue.predictionId, today.id)).limit(1)
      if (!queued) {
        await queuePredictionPost(d.cycle, today.id)
        return 'queued'
      }
    }
    return 'idle'
  }

  if (d.state.attempts >= d.cfg.maxAttemptsPerDay) return 'limit'
  if (now.getTime() - d.state.lastAttemptAt < d.cfg.minRetryMs) return 'retry_later'
  d.state.attempts++
  d.state.lastAttemptAt = now.getTime()

  // Harga dari feed yang terdaftar di kontrak (feed yang sama dipakai kontrak saat reveal). Waktu = waktu chain.
  const ledger = d.cycle.ledger
  const nowSec = await ledger.chainTime()
  const withFeeds: OracleAsset[] = []
  for (const a of d.cfg.assets) {
    const feed = await ledger.feedOf(a.asset)
    if (feed !== zeroAddress) withFeeds.push({ ...a, feed })
  }
  const candidates = await readOracleCandidates(d.read, withFeeds, nowSec)

  let draft
  try {
    draft = await generatePredictionDraft(d.llm, db, candidates)
  } catch (e) {
    if (e instanceof NoDataError) return 'no_data'
    throw e
  }

  const input: RiskGuardInput = { type: 'prediction', text: draft.text, tokens: [], dataComplete: true, facts: draft.facts }
  const decision = evaluate(input)
  if (!decision.allowed) {
    await db.insert(riskguardLog).values(toLogEntry(input, decision))
    return 'blocked'
  }

  const { id } = await draftPrediction(d.cycle, draft)
  await commitPrediction(d.cycle, id)
  await queuePredictionPost(d.cycle, id)
  return 'queued'
}
