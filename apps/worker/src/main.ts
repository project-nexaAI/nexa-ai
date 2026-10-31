import { z } from 'zod'
import { createDb } from '@nexa-ai/db'
import { publishDue, revealMatured, type CycleDeps } from './cycle'
import { createLedgerClient } from './ledger'

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

console.log(
  ledgerReady
    ? 'worker: commit/reveal aktif (mode post dry)'
    : 'worker: commit/reveal NONAKTIF (butuh AGENT_PRIVATE_KEY, NEXA_LEDGER_ADDRESS, PREIMAGE_KEY)',
)

async function tick(): Promise<void> {
  if (!deps) return
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
