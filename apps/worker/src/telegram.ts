import type { Db, PostMode } from './queue'
import { PipelineError, approvePost, getPost } from './queue'

/** Kanal notifikasi (Telegram untuk alert Pro dan kanal cadangan). */
export interface Notifier {
  send(text: string): Promise<void>
}

/** Mode dry: hanya log, tidak memanggil Telegram. */
export class DryTelegram implements Notifier {
  readonly sent: string[] = []
  async send(text: string): Promise<void> {
    this.sent.push(text)
    console.log(`[telegram:dry] ${text}`)
  }
}

/** Telegram Bot API. Token tidak pernah di-log; diisi manusia lewat env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID). */
export class TelegramBot implements Notifier {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(text: string): Promise<void> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`)
  }
}

/** Galat Telegram Bot API. Hanya status HTTP; URL (yang memuat token) tidak pernah ikut di pesan. */
export class TelegramError extends Error {
  constructor(readonly status: number) {
    super(`Telegram HTTP ${status}`)
  }
}

export interface TelegramUpdate {
  update_id: number
  message?: { chat: { id: number; type: string }; text?: string }
}

/** Pengirim pesan ke chat tertentu (pelanggan Pro). */
export interface ChatSender {
  sendMessage(chatId: string, text: string): Promise<void>
}

/** Telegram Bot API untuk bot Pro: kirim ke chat pelanggan dan membaca update (`/start <kode>`). Token tidak pernah di-log. */
export class TelegramApi implements ChatSender {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new TelegramError(res.status)
    return ((await res.json()) as { result: T }).result
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
  }

  /** Long polling: menunggu hingga `timeoutSec` detik untuk update baru dengan id >= offset. */
  getUpdates(offset: number, timeoutSec: number): Promise<TelegramUpdate[]> {
    return this.call('getUpdates', { offset, timeout: timeoutSec, allowed_updates: ['message'] })
  }
}

/**
 * Kanal cadangan PUBLIK (brief: Telegram sebagai kanal cadangan X). Terkirim bersamaan dengan post publik di X
 * (setelah tunda 15 menit), BUKAN saat persetujuan: alert Pro harus lebih awal dari publik. Mode dry hanya mencatat log:
 * mengirim ke kanal publik sama dengan menerbitkan, jadi hanya terjadi di mode live. Gagal kirim tidak menghentikan pipeline.
 */
export async function mirrorToBackup(opts: { mode: PostMode; notifier?: Notifier }, content: string): Promise<'sent' | 'dry' | 'none' | 'failed'> {
  if (opts.mode === 'dry') {
    console.log(`[telegram:backup:dry] ${content}`)
    return 'dry'
  }
  if (!opts.notifier) return 'none'
  try {
    await opts.notifier.send(content)
    return 'sent'
  } catch (e) {
    console.error('telegram backup gagal:', e instanceof Error ? e.message : String(e))
    return 'failed'
  }
}

/**
 * Alert Pro real-time: terkirim saat post disetujui, sedangkan post publik di X baru terbit 15 menit kemudian
 * (jadwal di antrian). Hanya post yang lolos RiskGuard dan disetujui yang pernah sampai ke sini.
 * `notifier` harus berupa chat PRIBADI Pro (TELEGRAM_PRO_CHAT_ID), bukan kanal publik.
 */
export async function approveAndAlert(db: Db, notifier: Notifier, id: number): Promise<void> {
  await approvePost(db, id)
  const post = await getPost(db, id)
  if (!post) throw new PipelineError(`post ${id} tidak ada`)
  await notifier.send(post.content)
}
