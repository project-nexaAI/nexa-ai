import { and, count, desc, eq, gte, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { getAddress } from 'viem'
import { ponsTokens, ponsTrades, whaleTransfers } from '@nexa-ai/db'
import type { Db } from './queue'

const HOUR_MS = 3_600_000
export const DAY_MS = 24 * HOUR_MS

/** Red flag yang boleh sampai ke prompt/teks. Nilai lain dari DB dibuang (data on-chain adalah input tak tepercaya). */
export const KNOWN_RED_FLAGS = ['High creator tax', 'Holders concentrated'] as const

/**
 * Simbol token dibuat pencipta token (input tak tepercaya: bisa berisi iklan, "BUY", atau instruksi untuk LLM).
 * Hanya simbol alfanumerik pendek yang dipakai; selain itu null (teks memakai sebutan generik).
 */
export const safeSymbol = (s: string | null): string | null => (s && /^[A-Za-z0-9]{2,10}$/.test(s) ? s : null)

export interface TokenFacts {
  address: string
  symbol: string | null
  ageSeconds: number
  graduated: boolean
  creatorTaxBps: number | null
  topHolderShareBps: number | null
  trades: { total: number; buys: number; sells: number }
  redFlags: string[]
}

/** Perbandingan alamat tanpa membedakan huruf besar/kecil (alamat tersimpan ber-checksum atau huruf kecil). */
const sameAddress = (col: AnyPgColumn, address: string): SQL => sql`lower(${col}) = ${address.toLowerCase()}`

/** Fakta satu token dari indexer. Null bila token tidak dikenal (jawaban: tidak tahu). */
export async function loadTokenFacts(db: Db, address: string, now: Date): Promise<TokenFacts | null> {
  const [t] = await db.select().from(ponsTokens).where(sameAddress(ponsTokens.address, address))
  if (!t) return null
  const side = async (s: 'buy' | 'sell') =>
    Number((await db.select({ n: count() }).from(ponsTrades).where(and(sameAddress(ponsTrades.token, t.address), eq(ponsTrades.side, s))))[0]!.n)
  const [buys, sells] = await Promise.all([side('buy'), side('sell')])
  return {
    address: getAddress(t.address),
    symbol: safeSymbol(t.symbol),
    ageSeconds: Math.max(0, Math.floor((now.getTime() - t.launchedAt.getTime()) / 1000)),
    graduated: t.graduatedAt !== null,
    creatorTaxBps: t.creatorTaxBps,
    topHolderShareBps: t.topHolderShareBps,
    trades: { total: buys + sells, buys, sells },
    redFlags: t.redFlags.filter((f) => (KNOWN_RED_FLAGS as readonly string[]).includes(f)),
  }
}

export interface PonsHighlights {
  /** Launch (dalam 24 jam terakhir) dengan trade terbanyak; umur >= 1 jam. */
  top: (TokenFacts & { trades24h: number }) | null
  /** Token yang graduate dalam 24 jam terakhir; umur >= 1 jam. */
  graduated: TokenFacts[]
}

export async function loadPonsHighlights(db: Db, now: Date, minAgeSeconds = 3600): Promise<PonsHighlights> {
  const since = new Date(now.getTime() - DAY_MS)
  const busy = await db
    .select({ token: ponsTrades.token, n: count() })
    .from(ponsTrades)
    .where(gte(ponsTrades.at, since))
    .groupBy(ponsTrades.token)
    .orderBy(desc(count()))
    .limit(25)

  // "Launch": diluncurkan dalam 24 jam terakhir (umur <= 24 jam), bukan token lama yang kebetulan ramai; dan umur >= 1 jam.
  let top: PonsHighlights['top'] = null
  for (const row of busy) {
    const f = await loadTokenFacts(db, row.token, now)
    if (!f || f.ageSeconds < minAgeSeconds || f.ageSeconds * 1000 > DAY_MS) continue
    top = { ...f, trades24h: Number(row.n) }
    break
  }

  const grads = await db.select().from(ponsTokens).where(gte(ponsTokens.graduatedAt, since)).orderBy(desc(ponsTokens.graduatedAt)).limit(5)
  const graduated: TokenFacts[] = []
  for (const g of grads) {
    const f = await loadTokenFacts(db, g.address, now)
    if (f && f.ageSeconds >= minAgeSeconds) graduated.push(f)
    if (graduated.length === 2) break
  }
  return { top, graduated }
}

export interface WhaleSummary {
  count: number
  /** Jumlah token utuh (tanpa desimal) yang dipindahkan, dihitung dari bigint. */
  totalTokens: string
}

/** Ringkasan transfer whale suatu token sejak `since` (dari indexer). Null bila tidak ada. */
export async function loadWhaleSummary(db: Db, token: string, since: Date): Promise<WhaleSummary | null> {
  const rows = await db
    .select({ amount: whaleTransfers.amount, decimals: whaleTransfers.decimals })
    .from(whaleTransfers)
    .where(and(sameAddress(whaleTransfers.token, token), gte(whaleTransfers.at, since)))
  if (rows.length === 0) return null
  const total = rows.reduce((a, r) => a + BigInt(r.amount) / 10n ** BigInt(r.decimals), 0n)
  return { count: rows.length, totalTokens: total.toString() }
}
