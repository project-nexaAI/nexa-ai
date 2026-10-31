// Menjalankan indexer Pons V2 di komputer lokal ke database Supabase testnet.
// DATABASE_URL dibaca dari ~/.config/nexa-ai/supabase-testnet.env (di luar repo) dan tidak pernah dicetak.
// Pakai: pnpm indexer:local            (mulai dari blok terbaru)
//        pnpm indexer:local 102200000  (ambil riwayat mulai blok itu)
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const file = join(homedir(), '.config', 'nexa-ai', 'supabase-testnet.env')
let text
try {
  text = readFileSync(file, 'utf8')
} catch {
  console.error(`Tidak bisa membaca ${file}`)
  process.exit(1)
}
const line = text.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
if (!line) {
  console.error('DATABASE_URL tidak ada di file env Supabase')
  process.exit(1)
}
const env = { ...process.env, DATABASE_URL: line.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, ''), CHAIN_ENV: 'mainnet' }
if (process.argv[2]) env.INDEXER_START_BLOCK = process.argv[2]

console.log('indexer lokal -> Supabase testnet (membaca chain mainnet). Ctrl+C untuk berhenti.')
const child = spawn('pnpm', ['--filter', '@nexa-ai/indexer', 'start'], { stdio: 'inherit', env, shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
