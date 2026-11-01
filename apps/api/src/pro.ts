import { randomBytes } from 'node:crypto'
import { and, eq, lt, sql } from 'drizzle-orm'
import type { Hex } from 'viem'
import { proPayments, proSubscriptions, telegramLinkCodes, telegramLinks } from '@nexa-ai/db'
import type { MeResponse } from '@nexa-ai/api-client'
import type { Db } from './app'
import { verifyUsdgPayment, type AskConfig } from './ask'

export interface ProConfig {
  /** Pembayaran USDG on-chain; `minAmount` = harga satu periode (19 USDG = 19_000_000). */
  payment: AskConfig
  /** Lama satu periode (brief: $19/bulan = 30 hari). */
  days: number
  /** Chain tempat USDG berada (mainnet 4663), untuk membangun transfer di wallet. */
  chainId: number
  /** Username bot Telegram tanpa @. Kosong = tautan Telegram nonaktif. */
  telegramBot?: string
  /** Selang polling stream alert ke database (ms). */
  alertPollMs?: number
  /** Selang heartbeat SSE (ms), agar proxy tidak memutus koneksi diam. */
  heartbeatMs?: number
}

export const LINK_CODE_TTL_MS = 10 * 60_000

export async function proStatus(db: Db, address: string, now: Date): Promise<MeResponse['pro']> {
  const [sub] = await db.select().from(proSubscriptions).where(eq(proSubscriptions.address, address))
  const [link] = await db.select({ a: telegramLinks.address }).from(telegramLinks).where(eq(telegramLinks.address, address))
  return {
    active: sub ? sub.expiresAt.getTime() > now.getTime() : false,
    expiresAt: sub ? sub.expiresAt.toISOString() : null,
    telegramLinked: Boolean(link),
  }
}

export type SubscribeResult =
  | { ok: true; expiresAt: Date; addedDays: number }
  | { ok: false; status: 402 | 403 | 409; error: string }

/**
 * Pembayaran sah = transfer USDG ke penerima di tx sukses, nilai >= harga, dikirim oleh alamat sesi.
 * Membayar kelipatan harga memberi kelipatan periode. Masa aktif diperpanjang dari akhir masa aktif yang masih berjalan.
 */
export async function subscribe(db: Db, cfg: ProConfig, address: string, txHash: string, now: Date): Promise<SubscribeResult> {
  const hash = txHash.toLowerCase()
  const [used] = await db.select({ h: proPayments.txHash }).from(proPayments).where(eq(proPayments.txHash, hash))
  if (used) return { ok: false, status: 409, error: 'payment_already_used' }

  const pay = await verifyUsdgPayment(cfg.payment, txHash as Hex)
  if (!pay.ok) return { ok: false, status: 402, error: pay.reason }
  // Pembayaran milik pengirimnya: mencegah orang lain mengklaim tx yang bukan miliknya.
  if (pay.payer.toLowerCase() !== address.toLowerCase()) return { ok: false, status: 403, error: 'payer_mismatch' }

  const periods = Number(pay.amount / cfg.payment.minAmount)
  const addedDays = periods * cfg.days

  return db.transaction(async (tx) => {
    const claimed = await tx
      .insert(proPayments)
      .values({ txHash: hash, payer: pay.payer, amount: pay.amount.toString(), days: addedDays })
      .onConflictDoNothing()
      .returning({ h: proPayments.txHash })
    if (claimed.length === 0) return { ok: false as const, status: 409 as const, error: 'payment_already_used' }

    const nowIso = now.toISOString()
    const [row] = await tx
      .insert(proSubscriptions)
      .values({ address, expiresAt: sql`${nowIso}::timestamptz + make_interval(days => ${addedDays})` })
      .onConflictDoUpdate({
        target: proSubscriptions.address,
        set: {
          expiresAt: sql`greatest(${proSubscriptions.expiresAt}, ${nowIso}::timestamptz) + make_interval(days => ${addedDays})`,
          updatedAt: now,
        },
      })
      .returning({ expiresAt: proSubscriptions.expiresAt })
    return { ok: true as const, expiresAt: row!.expiresAt, addedDays }
  })
}

/** Kode tautan Telegram sekali pakai. Kode lama milik alamat yang sama dan kode kedaluwarsa dibersihkan. */
export async function createLinkCode(db: Db, address: string, now: Date) {
  await db.delete(telegramLinkCodes).where(lt(telegramLinkCodes.expiresAt, now))
  await db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.address, address))
  const code = randomBytes(12).toString('hex')
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS)
  await db.insert(telegramLinkCodes).values({ code, address, expiresAt })
  return { code, expiresAt }
}

export async function unlinkTelegram(db: Db, address: string): Promise<void> {
  await db.delete(telegramLinks).where(eq(telegramLinks.address, address))
  await db.delete(telegramLinkCodes).where(and(eq(telegramLinkCodes.address, address)))
}
