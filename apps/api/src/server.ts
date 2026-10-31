import { z } from 'zod'
import { createDb } from '@nexa-ai/db'
import { createPublicClient, http } from 'viem'
import { CHAINS } from '@nexa-ai/shared'
import { buildApp } from './app'

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().default(4000),
    /** Asal web untuk CORS; beberapa dipisah koma. */
    WEB_ORIGIN: z.string().optional(),
    LEADERBOARD_MIN_SCORED: z.coerce.number().int().min(1).default(3),
    PAID_FEATURES_ENABLED: z.enum(['true', 'false']).default('false'),
    /** Ask NEXA: penerima pembayaran USDG (default TREASURY_ADDRESS) dan harga minimum (unit terkecil, 1000000 = $1). */
    ASK_PAYMENT_RECIPIENT: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    TREASURY_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    ASK_PRICE_USDG_MICROS: z.coerce.bigint().default(1_000_000n),
    ASK_RPC_URL: z.string().url().default(CHAINS.mainnet.rpc),
    EXPLORER_URL: z.string().url().default('https://explorer.testnet.chain.robinhood.com'),
    /** JSON: {"0xalamat": "NVDA"} */
    ASSET_SYMBOLS: z.string().default('{}'),
  })
  .parse(process.env)

const symbols = z.record(z.string()).parse(JSON.parse(env.ASSET_SYMBOLS))
const { db } = createDb(env.DATABASE_URL)
const askRecipient = env.ASK_PAYMENT_RECIPIENT ?? env.TREASURY_ADDRESS
// USDG yang terverifikasi hanya ada di mainnet; tanpa penerima atau USDG, /ask menjawab 503.
const ask =
  askRecipient && CHAINS.mainnet.usdg
    ? {
        client: createPublicClient({ transport: http(env.ASK_RPC_URL) }),
        usdg: CHAINS.mainnet.usdg,
        recipient: askRecipient as `0x${string}`,
        minAmount: env.ASK_PRICE_USDG_MICROS,
      }
    : undefined
const app = buildApp({
  db,
  explorerUrl: env.EXPLORER_URL.replace(/\/$/, ''),
  webOrigin: env.WEB_ORIGIN,
  leaderboardMinScored: env.LEADERBOARD_MIN_SCORED,
  paidFeaturesEnabled: env.PAID_FEATURES_ENABLED === 'true',
  ask,
  symbols: Object.fromEntries(Object.entries(symbols).map(([k, v]) => [k.toLowerCase(), v])),
})

await app.listen({ port: env.PORT, host: '0.0.0.0' })
console.log(`API NEXA di :${env.PORT}`)
