import { and, count, desc, eq, gte, inArray, ne } from 'drizzle-orm'
import { postQueue } from '@nexa-ai/db'
import { DAY_MS, loadPonsHighlights } from './facts'
import { buildGraduationFrom, buildLaunchFrom, buildSummary, type Built, type ReportDeps } from './reports'
import { enqueuePost } from './queue'

/** Jenis antrian untuk post pulse. Masuk X hanya bila ada di X_POST_KINDS. */
export const PULSE_KIND = 'pulse'

export interface PulseConfig {
  /** Jarak minimum antar pulse (ms). Arahan head dev: 30 menit. */
  intervalMs: number
  /** Token Pons yang sudah dibahas pulse tidak dibahas lagi dalam jendela ini. */
  tokenRepeatMs: number
  /** Stock Token yang sudah dibahas pulse tidak dibahas lagi dalam jendela ini. */
  stockRepeatMs: number
  /** Jeda minimum antar percobaan (ms), supaya kegagalan tidak membakar token LLM tiap siklus. */
  minRetryMs: number
  /** Gagal berulang untuk satu topik dalam satu proses: setelah sebanyak ini, topik dilewati. */
  maxFailuresPerTopic: number
  /** Samakan dengan X_LIVE_POST_CAP. Mode live: pulse berhenti dibuat setelah batas post live tercapai. */
  liveCap: number
}

export interface PulseDeps {
  /** Dependensi laporan (db, llm, mode, history, dex, aset Stock Token) dipakai ulang; state laporan tidak dipakai. */
  report: ReportDeps
  cfg: PulseConfig
  state: { lastAttemptAt: number; failures: Map<string, number> }
}

export type PulseStep = 'wait' | 'backlog' | 'cap_reached' | 'retry_later' | 'no_topic' | 'blocked' | 'queued' | 'error'

export const newPulseState = (): PulseDeps['state'] => ({ lastAttemptAt: 0, failures: new Map() })

/** Jendela bawaan: token Pons sekali sehari, Stock Token tiap 4 jam. */
export const DEFAULT_PULSE_WINDOWS = { tokenRepeatMs: DAY_MS, stockRepeatMs: 4 * 3_600_000 }

interface Topic {
  key: string
  /** Simbol yang wajib muncul di teks; juga dipakai untuk mengenali topik yang sudah dibahas. */
  symbol: string
  windowMs: number
  build: () => Promise<Built | null>
}

const mentions = (text: string, symbol: string) => new RegExp(`\\b${symbol}\\b`, 'i').test(text)

/**
 * Satu post pulse paling cepat tiap `intervalMs`, dari satu peristiwa nyata (graduation Pons, launch paling ramai,
 * lalu harga Stock Token). Tidak ada topik baru = tidak ada post. Urutan wajib brief tetap lewat enqueuePost:
 * data -> LLM -> RiskGuard -> antrian persetujuan. Aman dipanggil tiap siklus.
 *
 * Pengaman: satu pulse yang belum terbit (menunggu persetujuan atau jadwal) menahan pulse berikutnya, dan mode live berhenti
 * setelah batas post live tercapai, jadi antrian tidak menumpuk saat tidak ada yang menyetujui.
 */
export async function runPulse(d: PulseDeps, now = new Date()): Promise<PulseStep> {
  const { db } = d.report

  if (d.report.mode === 'live' && Number.isFinite(d.cfg.liveCap)) {
    const [posted] = await db.select({ n: count() }).from(postQueue).where(and(eq(postQueue.mode, 'live'), eq(postQueue.status, 'posted')))
    if (Number(posted?.n ?? 0) >= d.cfg.liveCap) return 'cap_reached'
  }

  const [open] = await db
    .select({ id: postQueue.id })
    .from(postQueue)
    .where(and(eq(postQueue.kind, PULSE_KIND), inArray(postQueue.status, ['pending_approval', 'approved'])))
    .limit(1)
  if (open) return 'backlog'

  const [last] = await db
    .select({ at: postQueue.createdAt })
    .from(postQueue)
    .where(and(eq(postQueue.kind, PULSE_KIND), ne(postQueue.status, 'rejected')))
    .orderBy(desc(postQueue.createdAt))
    .limit(1)
  if (last && now.getTime() - last.at.getTime() < d.cfg.intervalMs) return 'wait'
  if (now.getTime() - d.state.lastAttemptAt < d.cfg.minRetryMs) return 'retry_later'

  const widest = Math.max(d.cfg.tokenRepeatMs, d.cfg.stockRepeatMs)
  const recent = await db
    .select({ content: postQueue.content, at: postQueue.createdAt })
    .from(postQueue)
    .where(and(eq(postQueue.kind, PULSE_KIND), ne(postQueue.status, 'rejected'), gte(postQueue.createdAt, new Date(now.getTime() - widest))))
  const covered = (t: Topic) => recent.some((r) => now.getTime() - r.at.getTime() < t.windowMs && mentions(r.content, t.symbol))

  const topics: Topic[] = []
  const highlights = await loadPonsHighlights(db, now)
  for (const g of highlights.graduated) {
    if (!g.symbol) continue // simbol tidak aman ditampilkan: tidak dibahas (dan tidak bisa dilacak)
    topics.push({
      key: `grad:${g.address}`,
      symbol: g.symbol,
      windowMs: d.cfg.tokenRepeatMs,
      build: () => buildGraduationFrom(d.report, g),
    })
  }
  const top = highlights.top
  if (top?.symbol) {
    topics.push({
      key: `launch:${top.address}`,
      symbol: top.symbol,
      windowMs: d.cfg.tokenRepeatMs,
      build: () => buildLaunchFrom(d.report, top, top.trades24h),
    })
  }
  for (const a of d.report.cfg.stockAssets) {
    topics.push({
      key: `stock:${a.symbol}`,
      symbol: a.symbol,
      windowMs: d.cfg.stockRepeatMs,
      build: () => buildSummary({ ...d.report, cfg: { ...d.report.cfg, stockAssets: [a] } }, now),
    })
  }

  const topic = topics.find((t) => !covered(t) && (d.state.failures.get(t.key) ?? 0) < d.cfg.maxFailuresPerTopic)
  if (!topic) return 'no_topic'

  d.state.lastAttemptAt = now.getTime()
  const fail = (step: PulseStep): PulseStep => {
    d.state.failures.set(topic.key, (d.state.failures.get(topic.key) ?? 0) + 1)
    return step
  }
  try {
    const built = await topic.build()
    if (!built) return fail('no_topic')
    // Topik yang dibahas harus tampak di teks; tanpa itu pulse tidak bisa mengenali topik yang sudah dipakai.
    if (!mentions(built.text, topic.symbol)) return fail('no_topic')
    const r = await enqueuePost(db, {
      kind: PULSE_KIND,
      mode: d.report.mode,
      now,
      input: { type: 'daily_summary', text: built.text, tokens: built.tokens, dataComplete: true, facts: built.facts },
    })
    return r.status === 'rejected' ? fail('blocked') : 'queued'
  } catch (e) {
    console.error(`worker: pulse ${topic.key} gagal:`, e instanceof Error ? e.message : String(e))
    return fail('error')
  }
}
