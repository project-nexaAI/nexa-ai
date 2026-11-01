import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'
import { CHAINS } from '@nexa-ai/shared'
import testnetAddresses from '../../../packages/contracts-abi/addresses/testnet.json'
import { createDb } from '@nexa-ai/db'
import { publishDue, revealMatured, type CycleDeps } from './cycle'
import { newDailyState, runDailyPrediction, type DailyDeps } from './daily'
import { DEFAULT_KEEPER_CONFIG, mirrorPrices, type KeeperDeps, type MirrorFeed } from './keeper'
import { optionalEncKey, optionalPrivateKey } from './keys'
import { createLedgerClient } from './ledger'
import { dispatchProAlerts, pollTelegram } from './pro'
import { TelegramApi, TelegramBot } from './telegram'
import { OpenAiCompatibleLlm, pricingFromEnv } from './llm'
import { MAINNET_ORACLE_ASSETS, createFeedHistory, createFeedReader } from './oracle'
import { createDexClient, makeDexSource } from './dex'
import { runDailyReports, type ReportDeps } from './reports'

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    RPC_URL: z.string().url(),
    CHAIN_ID: z.coerce.number().int().default(46630),
    PREIMAGE_KEY: optionalEncKey,
    NEXA_LEDGER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    AGENT_PRIVATE_KEY: optionalPrivateKey,
    X_POST_MODE: z.enum(['dry', 'live']).default('dry'),
    LOOP_SECONDS: z.coerce.number().int().min(10).default(60),
    /** Prediction of the Day: hanya berjalan bila LLM_API_KEY ada (mock LLM tidak boleh meng-commit apa pun on-chain). */
    /** Kanal cadangan publik; tanpa keduanya tidak ada Telegram dari worker. */
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    LLM_BASE_URL: z.string().url().optional(),
    LLM_MODEL_SMALL: z.string().default('mimo-v2.6-flash'),
    LLM_MODEL_LARGE: z.string().default('mimo-v2.6-pro'),
    DAILY_PREDICTION_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(9),
    /** Ringkasan harian Stock Token dan laporan Pons: jam UTC paling awal dibuat (antrian persetujuan, tanpa commit on-chain). */
    DAILY_SUMMARY_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(13),
    PONS_REPORT_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(15),
    /** JSON [{"symbol":"NVDA","asset":"0x..","feed":"0x.."}] feed Chainlink Stock Token (RPC oracle); kosong = Stock Token mainnet (NVDA). */
    SUMMARY_ASSETS: z.string().optional(),
    /** Selisih DEX vs oracle: pool Uniswap v4 NVDA/USDG terdalam dipilih otomatis; DEX_POOL_ID mengunci satu pool (0x + 64 heks). Kedalaman minimum dalam USDG. */
    DEX_POOL_ID: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional().or(z.literal('')),
    DEX_MIN_DEPTH_USDG: z.coerce.number().positive().default(1000),
    /** JSON [{"symbol":"NVDA","asset":"0x..."}]; kosong = aset mainnet bila CHAIN_ID=4663. Feed harus terdaftar di NexaLedger. */
    PREDICTION_ASSETS: z.string().optional(),
    /** Keeper harga TESTNET: wallet sendiri (bukan agent) yang mendorong round ke feed tiruan. Kosong = nonaktif. */
    KEEPER_PRIVATE_KEY: optionalPrivateKey,
    /** JSON [{"symbol":"NVDA","source":"0x..mainnet","target":"0x..mock"}]; kosong = feed tiruan di addresses/testnet.json (CHAIN_ID=46630). */
    KEEPER_FEEDS: z.string().optional(),
    /** RPC mainnet tempat feed Chainlink asli dibaca. */
    ORACLE_RPC_URL: z.string().url().default(CHAINS.mainnet.rpc),
    KEEPER_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(300),
  })
  .parse(process.env)

// Mode live butuh izin eksplisit pemilik proyek: proses ini menolak berjalan live.
if (env.X_POST_MODE !== 'dry') throw new Error('X_POST_MODE=live belum diizinkan')

const { db } = createDb(env.DATABASE_URL)

// Commit/reveal aktif hanya jika kunci agent, alamat ledger, dan kunci enkripsi semuanya ada.
const ledgerReady = Boolean(env.AGENT_PRIVATE_KEY && env.NEXA_LEDGER_ADDRESS && env.PREIMAGE_KEY)
const deps: CycleDeps | null = ledgerReady
  ? {
      db,
      encKey: env.PREIMAGE_KEY!,
      mode: 'dry',
      ...(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? { backup: new TelegramBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID) } : {}),
      ledger: createLedgerClient({
        rpcUrl: env.RPC_URL,
        chainId: env.CHAIN_ID,
        ledgerAddress: env.NEXA_LEDGER_ADDRESS as `0x${string}`,
        agentPrivateKey: env.AGENT_PRIVATE_KEY as `0x${string}`,
      }),
    }
  : null

const assetsSchema = z.array(z.object({ symbol: z.string().min(1), asset: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }))
const predictionAssets = (
  env.PREDICTION_ASSETS ? assetsSchema.parse(JSON.parse(env.PREDICTION_ASSETS)) : env.CHAIN_ID === 4663 ? MAINNET_ORACLE_ASSETS : []
) as { symbol: string; asset: `0x${string}` }[]

// Satu klien LLM untuk semua pekerjaan (prediksi dan laporan). Tanpa LLM_API_KEY tidak ada yang dibuat (mock tidak boleh memposting).
const llm =
  env.LLM_API_KEY && env.LLM_BASE_URL
    ? new OpenAiCompatibleLlm({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY,
        modelSmall: env.LLM_MODEL_SMALL,
        modelLarge: env.LLM_MODEL_LARGE,
        pricing: pricingFromEnv(process.env),
      })
    : null

const dailyReady = Boolean(deps && llm && predictionAssets.length > 0)
const daily: DailyDeps | null =
  deps && llm && dailyReady
    ? {
        cycle: deps,
        llm,
        read: createFeedReader(env.RPC_URL),
        history: createFeedHistory(env.RPC_URL),
        cfg: { hourUtc: env.DAILY_PREDICTION_HOUR_UTC, assets: predictionAssets, maxAttemptsPerDay: 3, minRetryMs: 15 * 60 * 1000 },
        state: newDailyState(),
      }
    : null

// Ringkasan harian Stock Token dan laporan Pons V2: data indexer/oracle -> LLM -> RiskGuard -> antrian persetujuan. Tanpa commit on-chain,
// jadi hanya butuh LLM (bukan kunci agent). Mode post tetap dry; post publik butuh izin pemilik.
const summaryAssetsSchema = z.array(z.object({ symbol: z.string().min(1), asset: z.string().regex(/^0x[0-9a-fA-F]{40}$/), feed: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }))
const stockAssets = (
  env.SUMMARY_ASSETS ? summaryAssetsSchema.parse(JSON.parse(env.SUMMARY_ASSETS)) : MAINNET_ORACLE_ASSETS.filter((a) => a.symbol !== 'ETH')
) as { symbol: string; asset: `0x${string}`; feed: `0x${string}` }[]
const reports: ReportDeps | null = llm
  ? {
      db,
      llm,
      mode: 'dry',
      history: createFeedHistory(env.ORACLE_RPC_URL),
      ...(CHAINS.mainnet.uniswapV4.poolManager && CHAINS.mainnet.usdg
        ? {
            dex: makeDexSource(createDexClient(env.ORACLE_RPC_URL, CHAINS.mainnet.uniswapV4.poolManager), {
              usdg: CHAINS.mainnet.usdg,
              usdgDecimals: 6,
              minDepthUsdg: env.DEX_MIN_DEPTH_USDG,
              ...(env.DEX_POOL_ID ? { poolIdOverride: env.DEX_POOL_ID as `0x${string}` } : {}),
            }),
          }
        : {}),
      cfg: { summaryHourUtc: env.DAILY_SUMMARY_HOUR_UTC, ponsHourUtc: env.PONS_REPORT_HOUR_UTC, stockAssets, maxAttemptsPerDay: 3, minRetryMs: 15 * 60 * 1000 },
      state: new Map(),
    }
  : null
console.log(
  reports
    ? `worker: laporan harian AKTIF (ringkasan Stock Token ${env.DAILY_SUMMARY_HOUR_UTC}:00 UTC, laporan Pons ${env.PONS_REPORT_HOUR_UTC}:00 UTC)`
    : 'worker: laporan harian NONAKTIF (butuh LLM_API_KEY dan LLM_BASE_URL)',
)

// Keeper harga testnet: menyalin harga Chainlink mainnet ke feed tiruan agar reveal prediksi bisa berjalan.
const mirrorSchema = z.array(z.object({ symbol: z.string(), source: z.string().regex(/^0x[0-9a-fA-F]{40}$/), target: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }))
const defaultMirrors = (): MirrorFeed[] => {
  const c = testnetAddresses.contracts as Record<string, string | undefined>
  const out: MirrorFeed[] = []
  if (CHAINS.mainnet.chainlink.nvdaUsd && c.MockFeedNVDA) out.push({ symbol: 'NVDA', source: CHAINS.mainnet.chainlink.nvdaUsd, target: c.MockFeedNVDA as `0x${string}` })
  if (CHAINS.mainnet.chainlink.ethUsd && c.MockFeedETH) out.push({ symbol: 'ETH', source: CHAINS.mainnet.chainlink.ethUsd, target: c.MockFeedETH as `0x${string}` })
  return out
}
const mirrors = (env.KEEPER_FEEDS ? mirrorSchema.parse(JSON.parse(env.KEEPER_FEEDS)) : env.CHAIN_ID === 46630 ? defaultMirrors() : []) as MirrorFeed[]
const pushAbi = [{ type: 'function', name: 'push', stateMutability: 'nonpayable', inputs: [{ name: 'answer', type: 'int256' }, { name: 'updatedAt', type: 'uint256' }], outputs: [{ type: 'uint80' }] }] as const

let keeper: KeeperDeps | null = null
if (env.KEEPER_PRIVATE_KEY && mirrors.length > 0) {
  const chain = defineChain({ id: env.CHAIN_ID, name: `chain-${env.CHAIN_ID}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [env.RPC_URL] } } })
  const pub = createPublicClient({ chain, transport: http(env.RPC_URL) })
  const wallet = createWalletClient({ account: privateKeyToAccount(env.KEEPER_PRIVATE_KEY as `0x${string}`), chain, transport: http(env.RPC_URL) })
  keeper = {
    readSource: createFeedReader(env.ORACLE_RPC_URL),
    readTarget: createFeedReader(env.RPC_URL),
    push: async (target, answer, updatedAt) => {
      const hash = await wallet.writeContract({ address: target, abi: pushAbi, functionName: 'push', args: [answer, updatedAt] })
      const receipt = await pub.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error(`push gagal (tx ${hash})`)
      return hash
    },
    chainNowSec: async () => (await pub.getBlock()).timestamp,
    sourceNowSec: () => BigInt(Math.floor(Date.now() / 1000)),
    cfg: DEFAULT_KEEPER_CONFIG,
    mirrors,
  }
}
// NEXA Pro: bot Telegram yang sama menautkan chat pelanggan (/start <kode>) dan mengirim alert 15 menit sebelum post publik.
const proBot = env.TELEGRAM_BOT_TOKEN ? new TelegramApi(env.TELEGRAM_BOT_TOKEN) : null
console.log(proBot ? 'worker: alert Pro Telegram AKTIF (tautan chat + pengiriman ke pelanggan)' : 'worker: alert Pro Telegram NONAKTIF (butuh TELEGRAM_BOT_TOKEN)')

console.log(keeper ? `worker: keeper harga testnet AKTIF (${mirrors.map((m) => m.symbol).join(', ')})` : 'worker: keeper harga testnet NONAKTIF (butuh KEEPER_PRIVATE_KEY dan feed tiruan; hanya testnet)')
let lastKeeperAt = 0

console.log(
  daily
    ? `worker: prediksi harian AKTIF (mulai ${env.DAILY_PREDICTION_HOUR_UTC}:00 UTC, ${predictionAssets.length} aset)`
    : `worker: prediksi harian NONAKTIF (butuh commit/reveal aktif, LLM_API_KEY, LLM_BASE_URL, dan aset prediksi)`,
)
console.log(
  ledgerReady
    ? 'worker: commit/reveal aktif (mode post dry)'
    : 'worker: commit/reveal NONAKTIF (butuh AGENT_PRIVATE_KEY, NEXA_LEDGER_ADDRESS, PREIMAGE_KEY)',
)

async function tick(): Promise<void> {
  if (keeper && Date.now() - lastKeeperAt >= env.KEEPER_INTERVAL_SECONDS * 1000) {
    lastKeeperAt = Date.now()
    const res = await mirrorPrices(keeper)
    const notable = res.filter((r) => r.action === 'pushed' || r.action.endsWith('failed') || r.action.endsWith('error') || r.action === 'source_stale')
    if (notable.length) console.log(`worker: keeper: ${notable.map((r) => `${r.symbol}=${r.action}`).join(' ')}`)
  }
  if (proBot) {
    const d = await dispatchProAlerts(db, proBot)
    if (d.alerts) console.log(`worker: alert Pro: ${d.alerts} alert, ${d.sent} terkirim, ${d.failed} gagal, ${d.skippedPublic} sudah publik`)
  }
  if (reports) {
    const r = await runDailyReports(reports)
    if (r.summary === 'queued' || r.summary === 'blocked') console.log(`worker: ringkasan Stock Token: ${r.summary}`)
    if (r.pons === 'queued' || r.pons === 'blocked') console.log(`worker: laporan Pons: ${r.pons}`)
  }
  if (!deps) return
  if (daily) {
    const step = await runDailyPrediction(daily)
    if (step === 'queued' || step === 'blocked' || step === 'no_data') console.log(`worker: prediksi harian: ${step}`)
  }
  const posted = await publishDue(deps)
  const revealed = await revealMatured(deps)
  if (posted.length || revealed.length) console.log(`worker: posted=${posted.join(',')} revealed=${revealed.join(',')}`)
}

let stopping = false
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => (stopping = true))

// Long polling bot Pro berjalan terpisah dari siklus utama, supaya penautan chat terasa langsung (bukan menunggu LOOP_SECONDS).
if (proBot) {
  void (async () => {
    while (!stopping) {
      try {
        await pollTelegram(db, proBot, 25)
      } catch (e) {
        console.error('worker: polling Telegram gagal:', e instanceof Error ? e.message : String(e))
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  })()
}

while (!stopping) {
  try {
    await tick()
  } catch (e) {
    console.error('worker: siklus gagal:', e instanceof Error ? e.message : String(e))
  }
  await new Promise((r) => setTimeout(r, env.LOOP_SECONDS * 1000))
}
