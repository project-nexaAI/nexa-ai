// CLI persetujuan post NEXA terhadap database Supabase testnet.
// DATABASE_URL dibaca dari ~/.config/nexa-ai/supabase-testnet.env (di luar repo); TELEGRAM_BOT_TOKEN dan TELEGRAM_PRO_CHAT_ID
// dari .env di ROOT (untuk alert Pro saat approve). Nilai tidak pernah dicetak.
// Pakai:  pnpm review:testnet list | show <id> | approve <id> | reject <id>
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const read = (file) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}
const pick = (text, key) =>
  text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')

const db = pick(read(join(homedir(), '.config', 'nexa-ai', 'supabase-testnet.env')), 'DATABASE_URL')
if (!db) {
  console.error('DATABASE_URL tidak ditemukan di ~/.config/nexa-ai/supabase-testnet.env')
  process.exit(1)
}
const dotenv = read(join(process.cwd(), '.env'))
const env = { ...process.env, DATABASE_URL: db }
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_PRO_CHAT_ID']) {
  const v = pick(dotenv, k)
  if (v) env[k] = v
}
if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_PRO_CHAT_ID) console.warn('Catatan: TELEGRAM_BOT_TOKEN/TELEGRAM_PRO_CHAT_ID kosong di .env, alert Pro hanya dicatat (dry).')

const child = spawn('pnpm', ['--filter', '@nexa-ai/worker', 'review', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
