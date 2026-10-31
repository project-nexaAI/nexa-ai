import { and, eq, isNull, lte } from 'drizzle-orm'
import { kolAccounts, kolCalls } from '@nexa-ai/db'
import { DIRECTION, scoreCall, type Direction } from '@nexa-ai/shared'
import type { FeedReader, OracleAsset } from './oracle'
import type { Db } from './queue'

/** Toleransi round oracle setelah jatuh tempo (heartbeat feed 24 jam). */
export const SCORE_WINDOW_SECONDS = 24 * 3600
/** Harga awal harus segar: call dicatat saat dibuat, bukan belakangan. */
export const ENTRY_MAX_STALE_SECONDS = 3 * 24 * 3600

export const normalizeHandle = (h: string) => h.trim().replace(/^@/, '').toLowerCase()

export async function addKol(db: Db, handle: string, displayName: string) {
  const h = normalizeHandle(handle)
  if (!/^[a-z0-9_]{1,15}$/.test(h)) throw new Error('handle X tidak valid')
  const [row] = await db.insert(kolAccounts).values({ handle: h, displayName }).onConflictDoNothing().returning()
  return row ?? null
}

export interface NewCall {
  handle: string
  asset: OracleAsset
  direction: 'up' | 'down'
  horizonDays: number
  sourceUrl: string
  text: string
}

/** Catat call publik KOL. Harga awal dari oracle saat ini; sumber (link post asli) wajib sebagai bukti. */
export async function addCall(db: Db, read: FeedReader, c: NewCall, now = new Date()) {
  if (!/^https:\/\/(x|twitter)\.com\/.+/.test(c.sourceUrl)) throw new Error('sourceUrl harus link post X (https://x.com/...)')
  if (!Number.isInteger(c.horizonDays) || c.horizonDays < 1 || c.horizonDays > 90) throw new Error('horizon 1-90 hari')
  const [kol] = await db.select().from(kolAccounts).where(eq(kolAccounts.handle, normalizeHandle(c.handle)))
  if (!kol) throw new Error(`KOL ${c.handle} belum terdaftar (add-kol dulu)`)
  if (!kol.optedIn) throw new Error(`KOL ${c.handle} tidak opted-in`)
  const r = await read(c.asset.feed)
  const nowSec = BigInt(Math.floor(now.getTime() / 1000))
  if (r.answer <= 0n || nowSec - r.updatedAt > BigInt(ENTRY_MAX_STALE_SECONDS)) throw new Error('harga oracle tidak segar; call tidak dicatat')
  const [row] = await db
    .insert(kolCalls)
    .values({
      kolId: kol.id,
      text: c.text,
      asset: c.asset.asset,
      direction: c.direction === 'up' ? DIRECTION.UP : DIRECTION.DOWN,
      madeAt: now,
      maturesAt: new Date(now.getTime() + c.horizonDays * 86_400_000),
      sourceUrl: c.sourceUrl,
      startPrice: r.answer.toString(),
      priceDecimals: r.decimals,
    })
    .returning()
  return row!
}

/**
 * Nilai call yang sudah jatuh tempo dengan aturan yang sama dengan NexaLedger (scoreCall). Harga akhir = round oracle terbaru
 * HANYA jika baru diperbarui sesudah jatuh tempo dan masih dalam SCORE_WINDOW_SECONDS; selain itu dilewati (tidak ditebak).
 * Ini pendekatan: kontrak memakai round pertama setelah jatuh tempo, sedangkan call KOL tidak ada di chain.
 */
export async function scoreDueKolCalls(
  db: Db,
  read: FeedReader,
  assets: readonly OracleAsset[],
  now = new Date(),
  minMoveBps = 0,
): Promise<{ scored: number; skipped: number }> {
  const due = await db.select().from(kolCalls).where(and(isNull(kolCalls.scoredAt), lte(kolCalls.maturesAt, now)))
  let scored = 0
  let skipped = 0
  for (const c of due) {
    const feed = assets.find((a) => a.asset.toLowerCase() === c.asset.toLowerCase())?.feed
    if (!feed) {
      skipped++
      continue
    }
    try {
      const r = await read(feed)
      const matures = BigInt(Math.floor(c.maturesAt.getTime() / 1000))
      if (r.answer <= 0n || r.decimals !== c.priceDecimals || r.updatedAt < matures || r.updatedAt - matures > BigInt(SCORE_WINDOW_SECONDS)) {
        skipped++
        continue
      }
      const res = scoreCall({ direction: c.direction as Direction, startPrice: BigInt(c.startPrice), endPrice: r.answer, minMoveBps })
      await db.update(kolCalls).set({ endPrice: r.answer.toString(), scoredAt: now, won: res.won, returnBps: res.returnBps }).where(eq(kolCalls.id, c.id))
      scored++
    } catch {
      skipped++
    }
  }
  return { scored, skipped }
}
