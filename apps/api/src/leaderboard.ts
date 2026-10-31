import { eq } from 'drizzle-orm'
import { kolAccounts, kolCalls } from '@nexa-ai/db'
import type { LeaderboardResponse } from '@nexa-ai/api-client'
import type { Db } from './app'
import { formatBps, formatWinRate } from './format'

export interface BoardStats {
  handle: string
  displayName: string
  isNexa: boolean
  scored: number
  wins: number
  pending: number
  avgReturnBps: number | null
}

/** Statistik per KOL yang opted_in. Return dihitung searah klaim (call turun yang benar bernilai positif). */
export async function kolStats(db: Db): Promise<BoardStats[]> {
  const rows = await db
    .select({ k: kolAccounts, c: kolCalls })
    .from(kolAccounts)
    .leftJoin(kolCalls, eq(kolCalls.kolId, kolAccounts.id))
    .where(eq(kolAccounts.optedIn, true))
  const byKol = new Map<number, { k: typeof kolAccounts.$inferSelect; calls: (typeof kolCalls.$inferSelect)[] }>()
  for (const { k, c } of rows) {
    const e = byKol.get(k.id) ?? { k, calls: [] }
    if (c) e.calls.push(c)
    byKol.set(k.id, e)
  }
  return [...byKol.values()].map(({ k, calls }) => {
    const scoredCalls = calls.filter((c) => c.scoredAt !== null && c.returnBps !== null && c.won !== null)
    const aligned = scoredCalls.map((c) => (c.direction === 1 ? c.returnBps! : -c.returnBps!))
    return {
      handle: k.handle,
      displayName: k.displayName,
      isNexa: false,
      scored: scoredCalls.length,
      wins: scoredCalls.filter((c) => c.won).length,
      pending: calls.length - scoredCalls.length,
      avgReturnBps: aligned.length ? Math.round(aligned.reduce((a, b) => a + b, 0) / aligned.length) : null,
    }
  })
}

/** Peringkat: win rate turun, lalu jumlah call ternilai, lalu handle. Di bawah minScored: rank null dan di akhir. */
export function rankEntries(stats: BoardStats[], minScored: number): LeaderboardResponse['entries'] {
  const withRate = stats.map((s) => ({ ...s, winRate: s.scored > 0 ? s.wins / s.scored : null }))
  const ranked = withRate
    .filter((s) => s.scored >= Math.max(1, minScored))
    .sort((a, b) => b.winRate! - a.winRate! || b.scored - a.scored || a.handle.localeCompare(b.handle))
  const rest = withRate.filter((s) => !ranked.includes(s)).sort((a, b) => b.scored - a.scored || a.handle.localeCompare(b.handle))
  const out = (s: (typeof withRate)[number], rank: number | null) => ({
    rank,
    handle: s.handle,
    displayName: s.displayName,
    isNexa: s.isNexa,
    scored: s.scored,
    wins: s.wins,
    pending: s.pending,
    winRate: s.winRate,
    avgReturnBps: s.avgReturnBps,
    formatted: {
      winRate: s.winRate === null ? null : formatWinRate(s.winRate),
      avgReturn: s.avgReturnBps === null ? null : formatBps(s.avgReturnBps),
    },
  })
  return [...ranked.map((s, i) => out(s, i + 1)), ...rest.map((s) => out(s, null))]
}
