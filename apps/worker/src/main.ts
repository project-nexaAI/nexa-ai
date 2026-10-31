import { z } from 'zod'
import { createDb } from '@nexa-ai/db'
import { publishDue, revealMatured, type CycleDeps } from './cycle'
import { newDailyState, runDailyPrediction, type DailyDeps } from './daily'
import { createLedgerClient } from './ledger'
import { OpenAiCompatibleLlm, pricingFromEnv } from './llm'
import { MAINNET_ORACLE_ASSETS, createFeedReader } from './oracle'

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    RPC_URL: z.string().url(),
    CHAIN_ID: z.coerce.number().int().default(46630),
    PREIMAGE_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    NEXA_LEDGER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    AGENT_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    X_POST_MODE: z.enum(['dry', 'live']).default('dry'),
    LOOP_SECONDS: z.coerce.number().int().min(10).default(60),
    /** Prediction of the Day: hanya berjalan bila LLM_API_KEY ada (mock LLM tidak boleh meng-commit apa pun on-chain). */
    LLM_API_KEY: z.string().optional(),
    LLM_BASE_URL: z.string().url().optional(),
    LLM_MODEL_SMALL: z.string().default('mimo-v2.6-flash'),
    LLM_MODEL_LARGE: z.string().default('mimo-v2.6-pro'),
    DAILY_PREDICTION_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(9),
    /** JSON [{"symbol":"NVDA","asset":"0x..."}]; kosong = aset mainnet bila CHAIN_ID=4663. Feed harus terdaftar di NexaLedger. */
    PREDICTION_ASSETS: z.string().optional(),
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

const dailyReady = Boolean(deps && env.LLM_API_KEY && env.LLM_BASE_URL && predictionAssets.length > 0)
const daily: DailyDeps | null =
  deps && dailyReady
    ? {
        cycle: deps,
        llm: new OpenAiCompatibleLlm({
          baseUrl: env.LLM_BASE_URL!,
          apiKey: env.LLM_API_KEY!,
          modelSmall: env.LLM_MODEL_SMALL,
          modelLarge: env.LLM_MODEL_LARGE,
          pricing: pricingFromEnv(process.env),
        }),
        read: createFeedReader(env.RPC_URL),
        cfg: { hourUtc: env.DAILY_PREDICTION_HOUR_UTC, assets: predictionAssets, maxAttemptsPerDay: 3, minRetryMs: 15 * 60 * 1000 },
        state: newDailyState(),
      }
    : null

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

while (!stopping) {
  try {
    await tick()
  } catch (e) {
    console.error('worker: siklus gagal:', e instanceof Error ? e.message : String(e))
  }
  await new Promise((r) => setTimeout(r, env.LOOP_SECONDS * 1000))
}
