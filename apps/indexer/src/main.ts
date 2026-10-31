import { eq } from 'drizzle-orm'
import { createPublicClient, http, type PublicClient } from 'viem'
import { z } from 'zod'
import { createDb, indexerState } from '@nexa-ai/db'
import { CHAINS } from '@nexa-ai/shared'
import { curveAbi, erc20Abi, factoryAbi } from './abi'
import { processLogs, type PonsLog, type TokenMeta } from './process'

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    RPC_URL: z.string().url().default(CHAINS.mainnet.rpc),
    CHAIN_ENV: z.enum(['testnet', 'mainnet']).default('mainnet'),
    PONS_FACTORY: z.string().optional(),
    /** Blok awal bila belum ada kursor. Kosong = mulai dari ujung chain (tanpa backfill). */
    INDEXER_START_BLOCK: z.coerce.bigint().optional(),
    INDEXER_CHUNK_BLOCKS: z.coerce.bigint().default(2000n),
    INDEXER_POLL_SECONDS: z.coerce.number().int().positive().default(5),
    HIGH_CREATOR_TAX_BPS: z.coerce.number().int().nonnegative().default(500),
  })
  .parse(process.env)

const STATE = 'pons'
const factory = (env.PONS_FACTORY ?? CHAINS[env.CHAIN_ENV].pons.factory) as `0x${string}` | null | undefined
if (!factory) {
  console.error(`indexer: alamat factory Pons belum ada untuk ${env.CHAIN_ENV} (lihat BLOCKERS #6); berhenti`)
  process.exit(1)
}

const { db } = createDb(env.DATABASE_URL)
const client: PublicClient = createPublicClient({ transport: http(env.RPC_URL) })

const tryRead = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null)

async function readMeta(token: string, curve: string, pair: string): Promise<TokenMeta> {
  const t = token as `0x${string}`
  const [name, symbol, tax, decimals] = await Promise.all([
    tryRead(client.readContract({ address: t, abi: erc20Abi, functionName: 'name' })),
    tryRead(client.readContract({ address: t, abi: erc20Abi, functionName: 'symbol' })),
    tryRead(client.readContract({ address: curve as `0x${string}`, abi: curveAbi, functionName: 'creatorTaxBps' })),
    tryRead(client.readContract({ address: pair as `0x${string}`, abi: erc20Abi, functionName: 'decimals' })),
  ])
  return { name, symbol, creatorTaxBps: tax === null ? null : Number(tax), pairDecimals: decimals ?? 18 }
}

const times = new Map<bigint, Date>()
async function blockTime(n: bigint): Promise<Date> {
  const hit = times.get(n)
  if (hit) return hit
  const b = await client.getBlock({ blockNumber: n })
  const d = new Date(Number(b.timestamp) * 1000)
  if (times.size > 5000) times.clear()
  times.set(n, d)
  return d
}

async function fetchLogs(from: bigint, to: bigint): Promise<PonsLog[]> {
  const [launched, curve] = await Promise.all([
    client.getLogs({ address: factory!, events: factoryAbi, fromBlock: from, toBlock: to }),
    client.getLogs({ events: curveAbi.filter((x) => x.type === 'event'), fromBlock: from, toBlock: to }),
  ])
  return [...launched, ...curve].flatMap((l) =>
    l.blockNumber === null || l.logIndex === null || l.transactionHash === null ? [] : [l as unknown as PonsLog],
  )
}

async function tick() {
  const head = await client.getBlockNumber()
  const [state] = await db.select().from(indexerState).where(eq(indexerState.name, STATE))
  const next = state ? state.lastBlock + 1n : (env.INDEXER_START_BLOCK ?? head)
  if (next > head) return
  const to = next + env.INDEXER_CHUNK_BLOCKS - 1n < head ? next + env.INDEXER_CHUNK_BLOCKS - 1n : head
  const r = await processLogs({ db, readMeta, blockTime, highCreatorTaxBps: env.HIGH_CREATOR_TAX_BPS }, await fetchLogs(next, to))
  await db
    .insert(indexerState)
    .values({ name: STATE, lastBlock: to })
    .onConflictDoUpdate({ target: indexerState.name, set: { lastBlock: to, updatedAt: new Date() } })
  if (r.launches || r.trades) console.log(`indexer: blok ${next}-${to}: ${r.launches} launch, ${r.trades} trade`)
}

console.log(`indexer: ${env.CHAIN_ENV}, factory ${factory}`)
for (;;) {
  try {
    await tick()
  } catch (e) {
    console.error('indexer: tick gagal:', e instanceof Error ? e.message : e)
  }
  await new Promise((r) => setTimeout(r, env.INDEXER_POLL_SECONDS * 1000))
}
