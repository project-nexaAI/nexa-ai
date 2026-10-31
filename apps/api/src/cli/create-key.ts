import { createHash, randomBytes } from 'node:crypto'
import { createDb, apiKeys } from '@nexa-ai/db'

// Membuat kunci Signals API. Kunci asli hanya dicetak sekali di sini; database menyimpan hash SHA-256.
// Pakai: DATABASE_URL=... pnpm --filter @nexa-ai/api keys:create "nama pelanggan"
const label = process.argv[2]
const url = process.env.DATABASE_URL
if (!label || !url) throw new Error('Pakai: DATABASE_URL=... pnpm --filter @nexa-ai/api keys:create "<label>"')

const key = `nexa_${randomBytes(24).toString('hex')}`
const { db, client } = createDb(url)
await db.insert(apiKeys).values({ keyHash: createHash('sha256').update(key).digest('hex'), label })
await client.end()
console.log(`Kunci untuk "${label}" (simpan sekarang, tidak bisa dilihat lagi):\n${key}`)
