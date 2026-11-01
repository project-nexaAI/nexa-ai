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

/** Validasi masukan call yang tidak butuh DB/oracle; dipakai addCall dan impor CSV (sebelum akun KOL dibuat). */
export function assertCallInput(sourceUrl: string, horizonDays: number): void {
  if (!/^https:\/\/(x|twitter)\.com\/.+/.test(sourceUrl)) throw new Error('sourceUrl harus link post X (https://x.com/...)')
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 90) throw new Error('horizon 1-90 hari')
}

/** Catat call publik KOL. Harga awal dari oracle saat ini; sumber (link post asli) wajib sebagai bukti. */
export async function addCall(db: Db, read: FeedReader, c: NewCall, now = new Date()) {
  assertCallInput(c.sourceUrl, c.horizonDays)
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

// ------------------------------------------------------------------ impor CSV

/** CSV sederhana (RFC 4180): kolom boleh dikutip, `""` = tanda kutip, baris kosong dilewati. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export const KOL_CSV_COLUMNS = ['handle', 'display_name', 'asset', 'direction', 'days', 'source_url', 'text'] as const
export const KOL_CSV_MAX_ROWS = 500

export interface KolImportResult {
  kols: number
  calls: number
  errors: { line: number; message: string }[]
}

/**
 * Impor massal call KOL dari CSV (kolom: handle, display_name, asset, direction, days, source_url, text).
 * Setiap baris dicatat lewat addKol/addCall yang sama dengan CLI satuan, jadi aturannya identik (link post X wajib,
 * KOL harus opted-in, harga awal dari oracle). **Harga awal = harga oracle SAAT impor**, bukan saat call dibuat:
 * impor hanya untuk call baru. Baris yang salah dilaporkan dan dilewati; baris lain tetap diproses.
 */
export async function importKolCsv(db: Db, read: FeedReader, assets: readonly OracleAsset[], csv: string, now = new Date()): Promise<KolImportResult> {
  const rows = parseCsv(csv)
  const result: KolImportResult = { kols: 0, calls: 0, errors: [] }
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase())
  const missing = KOL_CSV_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) throw new Error(`kolom CSV kurang: ${missing.join(', ')}`)
  if (rows.length - 1 > KOL_CSV_MAX_ROWS) throw new Error(`maksimal ${KOL_CSV_MAX_ROWS} baris per impor`)
  const col = (r: string[], name: (typeof KOL_CSV_COLUMNS)[number]) => (r[header.indexOf(name)] ?? '').trim()

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!
    const line = i + 1
    try {
      const asset = assets.find((a) => a.symbol === col(r, 'asset').toUpperCase())
      if (!asset) throw new Error(`aset ${col(r, 'asset') || '(kosong)'} tidak didukung`)
      const direction = col(r, 'direction').toLowerCase()
      if (direction !== 'up' && direction !== 'down') throw new Error('direction harus up atau down')
      if (!col(r, 'text')) throw new Error('teks call kosong')
      assertCallInput(col(r, 'source_url'), Number(col(r, 'days'))) // sebelum akun KOL dibuat: baris salah tidak meninggalkan akun kosong
      if (await addKol(db, col(r, 'handle'), col(r, 'display_name') || col(r, 'handle'))) result.kols++
      await addCall(db, read, { handle: col(r, 'handle'), asset, direction, horizonDays: Number(col(r, 'days')), sourceUrl: col(r, 'source_url'), text: col(r, 'text') }, now)
      result.calls++
    } catch (e) {
      result.errors.push({ line, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return result
}
