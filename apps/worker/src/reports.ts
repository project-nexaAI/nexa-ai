import { and, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { postQueue } from '@nexa-ai/db'
import { REPORT_SYSTEM, buildPonsPrompt, buildSummaryPrompt, ponsFacts, summaryFacts, type StockSummaryItem } from '../prompts/reports'
import { recordLlmCosts } from './cycle'
import { DAY_MS, loadPonsHighlights, loadWhaleSummary } from './facts'
import { generateStructured, type LlmClient } from './llm'
import { DEFAULT_MAX_STALE_SECONDS, formatUsd, priceChange, type FeedHistory, type OracleAsset } from './oracle'
import { enqueuePost, type Db, type PostMode } from './queue'

export interface ReportConfig {
  /** Jam UTC paling awal ringkasan Stock Token dibuat. */
  summaryHourUtc: number
  /** Jam UTC paling awal laporan Pons V2 dibuat. */
  ponsHourUtc: number
  /** Stock Token yang diringkas (feed Chainlink dibaca dari RPC oracle, biasanya mainnet). */
  stockAssets: readonly OracleAsset[]
  /** Batas percobaan per jenis per hari UTC (draft ditolak RiskGuard atau LLM gagal). */
  maxAttemptsPerDay: number
  /** Jeda minimum antar percobaan (ms), supaya kegagalan tidak membakar token LLM tiap siklus. */
  minRetryMs: number
}

export interface ReportDeps {
  db: Db
  llm: LlmClient
  mode: PostMode
  history: FeedHistory
  cfg: ReportConfig
  /** Waktu percobaan terakhir per jenis (di memori). */
  state: Map<string, number>
}

export type ReportStep = 'not_yet' | 'done' | 'limit' | 'retry_later' | 'no_data' | 'blocked' | 'queued' | 'error'

interface Built {
  text: string
  facts: string[]
  tokens: { address: string; ageSeconds: number }[]
}

const textSchema = z.object({ text: z.string().min(10).max(280) })

async function writeText(d: ReportDeps, user: string): Promise<string> {
  const { value, usages } = await generateStructured(d.llm, textSchema, { tier: 'small', system: REPORT_SYSTEM, user })
  await recordLlmCosts(d.db, usages)
  return value.text
}

/**
 * Satu laporan per jenis per hari UTC. Urutan wajib brief: data -> LLM -> RiskGuard (di enqueuePost) -> antrian persetujuan.
 * Idempoten dan aman dipanggil tiap siklus: post yang ditolak RiskGuard tidak dihitung "selesai" (boleh dicoba lagi, dibatasi).
 */
async function runOnce(d: ReportDeps, kind: string, hourUtc: number, now: Date, build: () => Promise<Built | null>): Promise<ReportStep> {
  if (now.getUTCHours() < hourUtc) return 'not_yet'
  const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`)
  const rows = await d.db
    .select({ status: postQueue.status })
    .from(postQueue)
    .where(and(eq(postQueue.kind, kind), gte(postQueue.createdAt, dayStart)))
  if (rows.some((r) => r.status !== 'rejected')) return 'done'
  if (rows.length >= d.cfg.maxAttemptsPerDay) return 'limit'
  if (now.getTime() - (d.state.get(kind) ?? 0) < d.cfg.minRetryMs) return 'retry_later'
  d.state.set(kind, now.getTime())

  const built = await build()
  if (!built) return 'no_data'
  const r = await enqueuePost(d.db, {
    kind,
    mode: d.mode,
    now,
    input: { type: 'daily_summary', text: built.text, tokens: built.tokens, dataComplete: true, facts: built.facts },
  })
  return r.status === 'rejected' ? 'blocked' : 'queued'
}

/** Ringkasan Stock Token: harga oracle, perubahan dalam jendela ~24 jam, dan transfer whale dari indexer. DEX vs oracle belum tersedia. */
async function buildSummary(d: ReportDeps, now: Date): Promise<Built | null> {
  const items: StockSummaryItem[] = []
  const nowSec = BigInt(Math.floor(now.getTime() / 1000))
  for (const a of d.cfg.stockAssets) {
    let latest
    try {
      latest = await d.history.latest(a.feed)
    } catch {
      continue // feed gagal dibaca: dilewati, tidak ditebak
    }
    if (latest.answer <= 0n || latest.updatedAt === 0n || nowSec - latest.updatedAt > BigInt(DEFAULT_MAX_STALE_SECONDS)) continue
    const change = await priceChange(d.history, a.feed)
    const whales = await loadWhaleSummary(d.db, a.asset, new Date(now.getTime() - DAY_MS))
    items.push({
      symbol: a.symbol,
      price: `$${formatUsd(latest.answer, latest.decimals)}`,
      change: change ? { bps: change.changeBps, windowHours: change.windowHours } : null,
      whales,
    })
  }
  if (items.length === 0) return null
  return { text: await writeText(d, buildSummaryPrompt(items)), facts: summaryFacts(items), tokens: [] }
}

/** Laporan Pons V2: launch paling ramai 24 jam terakhir (+ red flag) dan graduation. Token < 1 jam tidak pernah dibahas. */
async function buildPons(d: ReportDeps, now: Date): Promise<Built | null> {
  const h = await loadPonsHighlights(d.db, now)
  if (!h.top && h.graduated.length === 0) return null
  const data = { top: h.top ? { token: h.top, trades24h: h.top.trades24h } : null, graduated: h.graduated }
  const tokens = [...(h.top ? [h.top] : []), ...h.graduated].map((t) => ({ address: t.address, ageSeconds: t.ageSeconds }))
  return { text: await writeText(d, buildPonsPrompt(data)), facts: ponsFacts(data), tokens }
}

export async function runDailyReports(d: ReportDeps, now = new Date()): Promise<{ summary: ReportStep; pons: ReportStep }> {
  const guard = async (kind: string, hour: number, build: () => Promise<Built | null>): Promise<ReportStep> => {
    try {
      return await runOnce(d, kind, hour, now, build)
    } catch (e) {
      // Satu laporan gagal (mis. LLM) tidak boleh menghentikan yang lain atau siklus worker.
      console.error(`worker: laporan ${kind} gagal:`, e instanceof Error ? e.message : String(e))
      return 'error'
    }
  }
  return {
    summary: await guard('daily_summary', d.cfg.summaryHourUtc, () => buildSummary(d, now)),
    pons: await guard('pons_report', d.cfg.ponsHourUtc, () => buildPons(d, now)),
  }
}
