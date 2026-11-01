import type { MarketResponse } from '@nexa-ai/api-client'
import { formatBps } from './format'

export interface SnapshotRow {
  asset: string
  source: 'dex' | 'oracle'
  price: bigint
  decimals: number
  at: Date
}

/** Titik seri maksimum per aset (cukup untuk grafik kecil). */
const MAX_POINTS = 96
/** Perubahan hanya dihitung dari riwayat sekurang-kurangnya ini (tidak menebak dari data sebentar). */
const MIN_WINDOW_MS = 3600_000
/** Harga DEX dianggap sepasang dengan oracle bila diambil dalam selang ini. */
const PAIR_MS = 30 * 60_000

/** Harga untuk tampilan: dua desimal, dibulatkan ke bawah (nilai mentah tetap dikirim utuh). */
function formatPrice(raw: bigint, decimals: number): string {
  const cents = decimals >= 2 ? raw / 10n ** BigInt(decimals - 2) : raw * 10n ** BigInt(2 - decimals)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

const amount = (raw: bigint, decimals: number) => ({ raw: raw.toString(), decimals, formatted: formatPrice(raw, decimals) })

/** Selisih (bps, dibulatkan ke nol) harga a terhadap b; desimal dinormalkan. */
function gapBps(a: bigint, aDec: number, b: bigint, bDec: number): number {
  const d = Math.max(aDec, bDec)
  const A = a * 10n ** BigInt(d - aDec)
  const B = b * 10n ** BigInt(d - bDec)
  return Number(((A - B) * 10_000n) / B)
}

/** Rows harus berurutan naik menurut `at`. */
export function buildMarket(rows: readonly SnapshotRow[], t: Date): MarketResponse {
  const bySymbol = new Map<string, SnapshotRow[]>()
  for (const r of rows) bySymbol.set(r.asset, [...(bySymbol.get(r.asset) ?? []), r])

  const assets: MarketResponse['assets'] = []
  for (const [symbol, list] of bySymbol) {
    const oracle = list.filter((r) => r.source === 'oracle' && r.price > 0n)
    const dex = list.filter((r) => r.source === 'dex' && r.price > 0n)
    const last = oracle[oracle.length - 1]
    if (!last) continue

    const dexAt = new Map(dex.map((r) => [r.at.getTime(), r]))
    const nearestDex = (at: number) => dex.filter((r) => Math.abs(r.at.getTime() - at) <= PAIR_MS).pop()
    const pairedDex = (at: number) => dexAt.get(at) ?? nearestDex(at)

    const step = Math.max(1, Math.ceil(oracle.length / MAX_POINTS))
    const thinned = oracle.filter((_, i) => i % step === 0 || i === oracle.length - 1)
    const series = thinned.map((r) => ({ at: r.at.toISOString(), oracle: r.price.toString(), dex: pairedDex(r.at.getTime())?.price.toString() ?? null }))

    const latestDex = pairedDex(last.at.getTime())
    const gap = latestDex ? gapBps(latestDex.price, latestDex.decimals, last.price, last.decimals) : null

    const first = oracle[0]!
    const spanMs = last.at.getTime() - first.at.getTime()
    const change = spanMs >= MIN_WINDOW_MS ? gapBps(last.price, last.decimals, first.price, first.decimals) : null

    assets.push({
      symbol,
      oracle: amount(last.price, last.decimals),
      dex: latestDex ? amount(latestDex.price, latestDex.decimals) : null,
      gapBps: gap,
      gapFormatted: gap === null ? null : formatBps(gap),
      changeBps: change,
      changeFormatted: change === null ? null : formatBps(change),
      windowHours: change === null ? null : Math.max(1, Math.round(spanMs / 3600_000)),
      series,
    })
  }
  assets.sort((a, b) => Math.abs(b.changeBps ?? -1) - Math.abs(a.changeBps ?? -1) || a.symbol.localeCompare(b.symbol))
  return { updatedAt: t.toISOString(), assets }
}
