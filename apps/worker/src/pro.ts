import { and, asc, eq, gt, isNull } from 'drizzle-orm'
import { indexerState, proAlerts, proSubscriptions, telegramLinkCodes, telegramLinks } from '@nexa-ai/db'
import type { Db } from './queue'
import { TelegramError, type ChatSender, type TelegramApi, type TelegramUpdate } from './telegram'

const BATCH = 20
const OFFSET_KEY = 'telegram_offset' // kursor update Telegram, disimpan di indexer_state (lastBlock = offset berikutnya)

const hhmm = (d: Date) => `${d.toISOString().slice(11, 16)} UTC`
export const alertText = (content: string, publicAt: Date | null) => (publicAt ? `${content}\n\nPublic on X around ${hhmm(publicAt)}.` : content)

export interface DispatchResult {
  alerts: number
  sent: number
  failed: number
  skippedPublic: number
}

/**
 * Fan-out alert Pro ke chat Telegram pelanggan aktif. Setiap alert diklaim sekali (at-most-once: lebih baik melewatkan
 * satu alert daripada mengirim ganda). Alert yang jadwal publiknya sudah lewat tidak dikirim: nilai Pro adalah lebih awal.
 * Chat yang memblokir bot (403) dilepas dari tautan; kegagalan lain tidak menghentikan pengiriman ke yang lain.
 */
export async function dispatchProAlerts(db: Db, sender: ChatSender, now: Date = new Date()): Promise<DispatchResult> {
  const res: DispatchResult = { alerts: 0, sent: 0, failed: 0, skippedPublic: 0 }
  const pending = await db.select().from(proAlerts).where(isNull(proAlerts.telegramDispatchedAt)).orderBy(asc(proAlerts.id)).limit(BATCH)
  for (const alert of pending) {
    const claimed = await db
      .update(proAlerts)
      .set({ telegramDispatchedAt: now })
      .where(and(eq(proAlerts.id, alert.id), isNull(proAlerts.telegramDispatchedAt)))
      .returning({ id: proAlerts.id })
    if (claimed.length === 0) continue // worker lain sudah mengambilnya
    res.alerts++
    if (alert.publicAt && alert.publicAt.getTime() <= now.getTime()) {
      res.skippedPublic++
      continue
    }
    const text = alertText(alert.content, alert.publicAt)
    const recipients = await db
      .select({ address: telegramLinks.address, chatId: telegramLinks.chatId })
      .from(telegramLinks)
      .innerJoin(proSubscriptions, eq(proSubscriptions.address, telegramLinks.address))
      .where(gt(proSubscriptions.expiresAt, now))
    for (const r of recipients) {
      try {
        await sender.sendMessage(r.chatId, text)
        res.sent++
      } catch (e) {
        res.failed++
        if (e instanceof TelegramError && e.status === 403) await db.delete(telegramLinks).where(eq(telegramLinks.address, r.address))
        console.error(`pro: alert ${alert.id} gagal ke satu chat:`, e instanceof Error ? e.message : String(e))
      }
    }
  }
  return res
}

const HELP =
  'NEXA Pro alerts. To connect this chat, open the Pro page on the NEXA site, connect your wallet, and press "Connect Telegram". Send /stop to disconnect.'

/** Menangani satu update bot. Hanya chat pribadi; `/start <kode>` menautkan, `/stop` memutus, lainnya dibalas bantuan. */
export async function handleTelegramUpdate(db: Db, sender: ChatSender, update: TelegramUpdate, now: Date = new Date()): Promise<void> {
  const msg = update.message
  if (!msg || msg.chat.type !== 'private') return
  const chatId = String(msg.chat.id)
  const text = (msg.text ?? '').trim()

  if (/^\/stop(@\w+)?$/i.test(text)) {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId))
    await sender.sendMessage(chatId, 'Disconnected. You will no longer receive Pro alerts here.')
    return
  }

  const code = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{8,64})$/i.exec(text)?.[1]
  if (!code) {
    await sender.sendMessage(chatId, HELP)
    return
  }

  // Kode sekali pakai: dihapus atomik, jadi dua chat tidak bisa memakai kode yang sama.
  const [row] = await db
    .delete(telegramLinkCodes)
    .where(and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, now)))
    .returning()
  if (!row) {
    await sender.sendMessage(chatId, 'That code is invalid or has expired. Generate a new one on the Pro page.')
    return
  }
  const [sub] = await db.select().from(proSubscriptions).where(eq(proSubscriptions.address, row.address))
  if (!sub || sub.expiresAt.getTime() <= now.getTime()) {
    await sender.sendMessage(chatId, 'Your NEXA Pro subscription is not active, so alerts cannot be enabled.')
    return
  }
  await db.transaction(async (tx) => {
    await tx.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId)) // satu chat, satu alamat
    await tx
      .insert(telegramLinks)
      .values({ address: row.address, chatId })
      .onConflictDoUpdate({ target: telegramLinks.address, set: { chatId, linkedAt: now } })
  })
  await sender.sendMessage(chatId, 'Connected. You will get NEXA Pro alerts here, ahead of the public post on X. Send /stop to disconnect.')
}

/** Satu putaran long polling. Kursor disimpan setelah update diproses; update yang gagal dilewati (tidak memblokir antrean). */
export async function pollTelegram(db: Db, api: Pick<TelegramApi, 'getUpdates'> & ChatSender, timeoutSec: number, now: () => Date = () => new Date()): Promise<number> {
  const [state] = await db.select().from(indexerState).where(eq(indexerState.name, OFFSET_KEY))
  const offset = state ? Number(state.lastBlock) : 0
  const updates = await api.getUpdates(offset, timeoutSec)
  let next = offset
  for (const u of updates) {
    try {
      await handleTelegramUpdate(db, api, u, now())
    } catch (e) {
      console.error('pro: update Telegram gagal diproses:', e instanceof Error ? e.message : String(e))
    }
    next = Math.max(next, u.update_id + 1)
  }
  if (next !== offset) {
    await db
      .insert(indexerState)
      .values({ name: OFFSET_KEY, lastBlock: BigInt(next) })
      .onConflictDoUpdate({ target: indexerState.name, set: { lastBlock: BigInt(next), updatedAt: new Date() } })
  }
  return updates.length
}
