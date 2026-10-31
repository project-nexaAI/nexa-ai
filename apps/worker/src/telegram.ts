import type { Db } from './queue'
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

/**
 * Alert Pro real-time: terkirim saat post disetujui, sedangkan post publik di X baru terbit 15 menit kemudian
 * (jadwal di antrian). Hanya post yang lolos RiskGuard dan disetujui yang pernah sampai ke sini.
 */
export async function approveAndAlert(db: Db, notifier: Notifier, id: number): Promise<void> {
  await approvePost(db, id)
  const post = await getPost(db, id)
  if (!post) throw new PipelineError(`post ${id} tidak ada`)
  await notifier.send(post.content)
}
