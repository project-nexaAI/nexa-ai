import { lt } from 'drizzle-orm'
import { priceSnapshots } from '@nexa-ai/db'
import { MAX_PLAUSIBLE_GAP_BPS, dexGapBps, type DexSource } from './dex'
import { DEFAULT_MAX_STALE_SECONDS, type FeedHistory, type OracleAsset } from './oracle'
import type { Db } from './queue'

export interface MarketDeps {
  db: Db
  history: FeedHistory
  /** Opsional; tanpa ini hanya harga oracle yang dicatat. */
  dex?: DexSource
  assets: readonly OracleAsset[]
  /** Snapshot lebih tua dari ini dihapus (API hanya membaca 24 jam). */
  retentionMs: number
}

export interface MarketResult {
  oracle: number
  dex: number
}

/**
 * Mencatat harga oracle (dan DEX bila ada pool yang cukup dalam dan selisihnya wajar) per aset ke price_snapshots.
 * Kolom `asset` berisi simbol (mis. "NVDA"). Satu aset gagal tidak menghentikan yang lain; yang basi atau tak terbaca dilewati.
 * Oracle dan DEX satu aset memakai `at` yang sama supaya API bisa memasangkannya.
 */
export async function recordMarketSnapshots(d: MarketDeps, now: Date = new Date()): Promise<MarketResult> {
  const nowSec = BigInt(Math.floor(now.getTime() / 1000))
  const res: MarketResult = { oracle: 0, dex: 0 }
  for (const a of d.assets) {
    let latest
    try {
      latest = await d.history.latest(a.feed)
    } catch {
      continue
    }
    if (latest.answer <= 0n || latest.updatedAt === 0n || nowSec - latest.updatedAt > BigInt(DEFAULT_MAX_STALE_SECONDS)) continue
    await d.db.insert(priceSnapshots).values({ asset: a.symbol, source: 'oracle', price: latest.answer.toString(), decimals: latest.decimals, roundId: latest.roundId.toString(), at: now })
    res.oracle++
    if (!d.dex) continue
    try {
      const q = await d.dex(a.asset)
      if (!q) continue
      const gap = dexGapBps(q.priceE8, latest.answer, latest.decimals)
      if (gap === null || Math.abs(gap) > MAX_PLAUSIBLE_GAP_BPS) continue
      await d.db.insert(priceSnapshots).values({ asset: a.symbol, source: 'dex', price: q.priceE8.toString(), decimals: 8, at: now })
      res.dex++
    } catch {
      // DEX gagal sesaat: seri DEX berlubang, oracle tetap tercatat.
    }
  }
  await d.db.delete(priceSnapshots).where(lt(priceSnapshots.at, new Date(now.getTime() - d.retentionMs)))
  return res
}
