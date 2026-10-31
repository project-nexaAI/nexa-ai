import { z } from 'zod'
import { createDb } from '@nexa-ai/db'
import { buildApp } from './app'

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().default(4000),
    WEB_ORIGIN: z.string().optional(),
    EXPLORER_URL: z.string().url().default('https://explorer.testnet.chain.robinhood.com'),
    /** JSON: {"0xalamat": "NVDA"} */
    ASSET_SYMBOLS: z.string().default('{}'),
  })
  .parse(process.env)

const symbols = z.record(z.string()).parse(JSON.parse(env.ASSET_SYMBOLS))
const { db } = createDb(env.DATABASE_URL)
const app = buildApp({
  db,
  explorerUrl: env.EXPLORER_URL.replace(/\/$/, ''),
  webOrigin: env.WEB_ORIGIN,
  symbols: Object.fromEntries(Object.entries(symbols).map(([k, v]) => [k.toLowerCase(), v])),
})

await app.listen({ port: env.PORT, host: '0.0.0.0' })
console.log(`API NEXA di :${env.PORT}`)
