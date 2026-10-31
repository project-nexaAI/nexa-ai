// Mengirim satu pesan uji ke kanal Telegram memakai TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID dari .env di ROOT.
// Token tidak pernah dicetak. Pakai: pnpm telegram:test
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let text
try {
  text = readFileSync(join(process.cwd(), '.env'), 'utf8')
} catch {
  console.error('Tidak menemukan .env di folder ini. Jalankan dari ROOT proyek.')
  process.exit(1)
}
const get = (k) => text.split(/\r?\n/).find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, '')
const token = get('TELEGRAM_BOT_TOKEN')
const chat = get('TELEGRAM_CHAT_ID')
if (!token || !chat) {
  console.error(`Kosong di .env: ${!token ? 'TELEGRAM_BOT_TOKEN ' : ''}${!chat ? 'TELEGRAM_CHAT_ID' : ''}`)
  process.exit(1)
}
if (!/^\d+:[\w-]{30,}$/.test(token)) console.warn('Peringatan: bentuk token tidak seperti biasanya (harus angka:huruf-angka, tanpa awalan "bot", tanpa spasi).')

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text: 'NEXA: tes koneksi bot. Pesan ini bisa diabaikan.' }),
})
const body = await res.json().catch(() => ({}))
if (body.ok) console.log(`Berhasil: pesan terkirim ke ${chat}.`)
else console.error(`Gagal (HTTP ${res.status}): ${body.description ?? 'tidak diketahui'}`)
process.exit(body.ok ? 0 : 1)
