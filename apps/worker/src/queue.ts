import { and, asc, eq, lte } from 'drizzle-orm'
import type { createDb } from '@nexa-ai/db'
import { postQueue, predictions, proAlerts, riskguardLog } from '@nexa-ai/db'
import {
  evaluate,
  toLogEntry,
  type RiskGuardConfig,
  type RiskGuardDecision,
  type RiskGuardInput,
} from '@nexa-ai/riskguard'

export type Db = ReturnType<typeof createDb>['db']
export type PostMode = 'dry' | 'live'

/** Post publik ditunda 15 menit dari alert Pro (brief, aturan pipeline 5). */
export const PUBLIC_POST_DELAY_MS = 15 * 60 * 1000

export interface EnqueueParams {
  kind: string
  /** Isi untuk RiskGuard: tipe konten, teks, tokens dari tool result, dataComplete. */
  input: RiskGuardInput
  mode: PostMode
  /** Wajib untuk kind 'prediction'. */
  predictionId?: number
  /** id post X yang dibalas (hanya mention_reply). */
  replyTo?: string
  riskguardConfig?: Partial<RiskGuardConfig>
  now?: Date
}

export interface EnqueueResult {
  id: number
  status: 'pending_approval' | 'approved' | 'rejected'
  decision: RiskGuardDecision
}

export class PipelineError extends Error {}

/**
 * Pintu masuk tunggal ke antrian. Urutan wajib brief:
 * (AI sudah menghasilkan teks) -> RiskGuard -> [prediksi: commit terkonfirmasi] -> antrian -> post.
 */
export async function enqueuePost(db: Db, p: EnqueueParams): Promise<EnqueueResult> {
  const now = p.now ?? new Date()

  // Aturan 2: prediksi tidak boleh diposting sebelum tx commit terkonfirmasi dan hash-nya tersimpan.
  if (p.kind === 'prediction') {
    if (p.predictionId === undefined) throw new PipelineError('post prediksi wajib punya predictionId')
    const [pred] = await db.select().from(predictions).where(eq(predictions.id, p.predictionId))
    if (!pred) throw new PipelineError(`prediksi ${p.predictionId} tidak ada`)
    if (pred.status !== 'committed' || !pred.commitTxHash) {
      throw new PipelineError(`prediksi ${p.predictionId} belum ter-commit on-chain; tidak boleh masuk antrian`)
    }
  }

  // Aturan 1: tidak ada post yang keluar sebelum lolos RiskGuard. Setiap keputusan dicatat.
  const decision = evaluate(p.input, p.riskguardConfig)
  const entry = toLogEntry(p.input, decision)
  await db.insert(riskguardLog).values(entry)

  const status = !decision.allowed ? 'rejected' : decision.requiresApproval ? 'pending_approval' : 'approved'
  // Post yang lolos tanpa persetujuan manusia langsung menjadi alert Pro; post dan alert dibuat atomik.
  const row = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(postQueue)
      .values({
        kind: p.kind,
        content: p.input.text,
        status,
        riskguard: decision,
        predictionId: p.predictionId ?? null,
        replyTo: p.replyTo ?? null,
        scheduledAt: new Date(now.getTime() + PUBLIC_POST_DELAY_MS),
        mode: p.mode,
      })
      .returning()
    if (status === 'approved') await recordProAlert(tx as unknown as Db, post!)
    return post!
  })
  return { id: row.id, status, decision }
}

/**
 * Alert Pro: dibuat saat post disetujui (manusia atau otomatis), 15 menit sebelum post publik di X.
 * Sumber stream SSE dan pengiriman Telegram ke pelanggan. Idempoten per post.
 */
export async function recordProAlert(db: Db, post: { id: number; kind: string; content: string; scheduledAt: Date | null }): Promise<void> {
  await db
    .insert(proAlerts)
    .values({ postId: post.id, kind: post.kind, content: post.content, publicAt: post.scheduledAt })
    .onConflictDoNothing()
}

export async function listPending(db: Db) {
  return db.select().from(postQueue).where(eq(postQueue.status, 'pending_approval')).orderBy(asc(postQueue.id))
}

export async function getPost(db: Db, id: number) {
  const [row] = await db.select().from(postQueue).where(eq(postQueue.id, id))
  return row
}

async function transition(db: Db, id: number, to: 'approved' | 'rejected') {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(postQueue)
      .set({ status: to })
      .where(and(eq(postQueue.id, id), eq(postQueue.status, 'pending_approval')))
      .returning()
    if (updated.length === 0) throw new PipelineError(`post ${id} tidak ada atau tidak sedang menunggu persetujuan`)
    if (to === 'approved') await recordProAlert(tx as unknown as Db, updated[0]!)
  })
}

/** Hanya post yang sudah lolos RiskGuard yang bisa disetujui; yang diblokir otomatis tidak pernah pending. */
export const approvePost = (db: Db, id: number) => transition(db, id, 'approved')
export const rejectPost = (db: Db, id: number) => transition(db, id, 'rejected')

/** Post siap terbit: disetujui dan sudah lewat jadwal tunda 15 menit. */
export async function dueForPublish(db: Db, now = new Date()) {
  return db
    .select()
    .from(postQueue)
    .where(and(eq(postQueue.status, 'approved'), lte(postQueue.scheduledAt, now)))
    .orderBy(asc(postQueue.scheduledAt))
}
