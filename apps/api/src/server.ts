import { z } from 'zod'
import { createDb } from '@nexa-ai/db'
import { createPublicClient, http } from 'viem'
import { CHAINS } from '@nexa-ai/shared'
import { buildApp } from './app'
import { resolvePaymentNetwork } from './payment-network'

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
    /** Jaringan pembayaran. Default mainnet (USDG resmi). 46630 hanya untuk uji dengan PAYMENT_USDG_ADDRESS = token uji. */
    PAYMENT_CHAIN_ID: z.coerce.number().int().default(CHAINS.mainnet.id),
    PAYMENT_USDG_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional().or(z.literal('')),
    PAYMENT_RPC_URL: z.string().url().optional().or(z.literal('')),
    /** NEXA Pro: penerima (default = penerima Ask NEXA), harga per periode (unit terkecil, 7000000 = $7), lama periode (hari). */
    PRO_PAYMENT_RECIPIENT: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    PRO_PRICE_USDG_MICROS: z.coerce.bigint().positive().default(7_000_000n),
    PRO_DAYS: z.coerce.number().int().min(1).default(30),
    /** Username bot Telegram (tanpa @) untuk tautan alert Pro; kosong = tautan Telegram nonaktif. */
    TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/).optional().or(z.literal('')),
    /** Benefit holder $NEXA: token (ada setelah launch di Pons V2) dan ambang saldo (unit terkecil, 18 desimal). Kosong = nonaktif. */
    NEXA_TOKEN_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional().or(z.literal('')),
    HOLDER_THRESHOLD: z.coerce.bigint().positive().optional().or(z.literal('')),
    HOLDER_FREE_ASKS_PER_MONTH: z.coerce.number().int().min(0).default(3),
    HOLDER_RPC_URL: z.string().url().default(CHAINS.mainnet.rpc),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).default(24),
    EXPLORER_URL: z.string().url().default('https://explorer.testnet.chain.robinhood.com'),
    /** Explorer untuk link token Pons: token yang diindeks ada di mainnet, jadi default mainnet (bukan EXPLORER_URL). */
    TOKEN_EXPLORER_URL: z.string().url().default(CHAINS.mainnet.explorer),
    /** JSON: {"0xalamat": "NVDA"} */
    ASSET_SYMBOLS: z.string().default('{}'),
  })
  .parse(process.env)

const symbols = z.record(z.string()).parse(JSON.parse(env.ASSET_SYMBOLS))
const { db } = createDb(env.DATABASE_URL)
const askRecipient = env.ASK_PAYMENT_RECIPIENT ?? env.TREASURY_ADDRESS
// USDG resmi hanya ada di mainnet; testnet memakai token uji dari env. Tanpa penerima atau USDG, /ask menjawab 503.
const network = resolvePaymentNetwork({
  PAYMENT_CHAIN_ID: env.PAYMENT_CHAIN_ID,
  PAYMENT_USDG_ADDRESS: env.PAYMENT_USDG_ADDRESS || undefined,
  PAYMENT_RPC_URL: env.PAYMENT_RPC_URL || undefined,
  ASK_RPC_URL: env.ASK_RPC_URL,
})
const ask =
  askRecipient && network
    ? {
        client: createPublicClient({ transport: http(network.rpcUrl) }),
        usdg: network.usdg,
        recipient: askRecipient as `0x${string}`,
        minAmount: env.ASK_PRICE_USDG_MICROS,
        chainId: network.chainId,
        chain: network.chain,
      }
    : undefined
const proRecipient = env.PRO_PAYMENT_RECIPIENT ?? askRecipient
const pro =
  proRecipient && network
    ? {
        payment: {
          client: createPublicClient({ transport: http(network.rpcUrl) }),
          usdg: network.usdg,
          recipient: proRecipient as `0x${string}`,
          minAmount: env.PRO_PRICE_USDG_MICROS,
        },
        days: env.PRO_DAYS,
        chainId: network.chainId,
        chain: network.chain,
        ...(env.TELEGRAM_BOT_USERNAME ? { telegramBot: env.TELEGRAM_BOT_USERNAME } : {}),
      }
    : undefined
// Domain SIWE = host dari asal web yang diizinkan CORS (WEB_ORIGIN, beberapa dipisah koma).
const siweDomains = (env.WEB_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
  .map((o) => new URL(o).host)
const holder =
  env.NEXA_TOKEN_ADDRESS && env.HOLDER_THRESHOLD
    ? {
        client: createPublicClient({ transport: http(env.HOLDER_RPC_URL) }),
        token: env.NEXA_TOKEN_ADDRESS as `0x${string}`,
        threshold: BigInt(env.HOLDER_THRESHOLD),
        decimals: 18,
        freeAsksPerMonth: env.HOLDER_FREE_ASKS_PER_MONTH,
      }
    : undefined
const app = buildApp({
  db,
  explorerUrl: env.EXPLORER_URL.replace(/\/$/, ''),
  tokenExplorerUrl: env.TOKEN_EXPLORER_URL.replace(/\/$/, ''),
  webOrigin: env.WEB_ORIGIN,
  leaderboardMinScored: env.LEADERBOARD_MIN_SCORED,
  paidFeaturesEnabled: env.PAID_FEATURES_ENABLED === 'true',
  ask,
  pro,
  auth: siweDomains.length ? { domains: siweDomains, sessionTtlSeconds: env.SESSION_TTL_HOURS * 3600, nonceTtlSeconds: 300, holder } : undefined,
  symbols: Object.fromEntries(Object.entries(symbols).map(([k, v]) => [k.toLowerCase(), v])),
})

await app.listen({ port: env.PORT, host: '0.0.0.0' })
console.log(`API NEXA di :${env.PORT}`)
