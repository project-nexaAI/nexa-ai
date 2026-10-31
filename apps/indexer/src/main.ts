import { eq, gte } from 'drizzle-orm'
import { createPublicClient, getAddress, http, parseAbi, type PublicClient } from 'viem'
import { z } from 'zod'
import { createDb, indexerState, ponsTokens } from '@nexa-ai/db'
import { CHAINS } from '@nexa-ai/shared'
import { burnedAbi, curveAbi, erc20Abi, factoryAbi, transferAbi } from './abi'
import { processBurns, type BurnLog } from './burns'
import { applyTransfers, defaultExcluded, type TransferLog, type WhaleToken } from './holders'
import { processLogs, type PonsLog, type TokenMeta } from './process'

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
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
    /** Satu holder (di luar curve/pool) >= ini dari total suplai = red flag "Holders concentrated". */
    HOLDER_CONCENTRATED_BPS: z.coerce.number().int().min(1).max(10_000).default(2000),
    /** Transfer token hanya dilacak untuk token yang diluncurkan dalam N hari terakhir (membatasi beban getLogs). */
    HOLDER_TRACK_DAYS: z.coerce.number().int().min(1).default(7),
    /** Transfer whale: JSON [{"address":"0x..","symbol":"NVDA","decimals":18,"feed":"0x.."}]; kosong = NVDA mainnet. */
    WHALE_TOKENS: z.string().optional(),
    WHALE_MIN_USD: z.coerce.number().positive().default(100_000),
    /** Alamat BurnVault; kosong = pembaca burn nonaktif (kontrak belum di-deploy). */
    BURN_VAULT_ADDRESS: addr.optional().or(z.literal('')),
  })
  .parse(process.env)

const STATE = 'pons'
const net = CHAINS[env.CHAIN_ENV]
const factory = (env.PONS_FACTORY ?? net.pons.factory) as `0x${string}` | null | undefined
if (!factory) {
  console.error(`indexer: alamat factory Pons belum ada untuk ${env.CHAIN_ENV} (lihat BLOCKERS #6); berhenti`)
  process.exit(1)
}

const { db } = createDb(env.DATABASE_URL)
const client: PublicClient = createPublicClient({ transport: http(env.RPC_URL) })
type Db = Parameters<typeof processLogs>[0]['db']

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

// ---- transfer whale: token yang dipantau + harga dari feed Chainlink
const aggAbi = parseAbi(['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'])
const whaleCfg = z
  .array(z.object({ address: addr, symbol: z.string(), decimals: z.number().int().min(0).max(36), feed: addr }))
  .parse(
    env.WHALE_TOKENS
      ? JSON.parse(env.WHALE_TOKENS)
      : env.CHAIN_ENV === 'mainnet' && net.chainlink.nvdaUsd
        ? [{ address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', symbol: 'NVDA', decimals: 18, feed: net.chainlink.nvdaUsd }]
        : [],
  )
const whaleTokens = new Map<string, WhaleToken>(whaleCfg.map((w) => [w.address.toLowerCase(), { symbol: w.symbol, decimals: w.decimals }]))
const feedOf = new Map(whaleCfg.map((w) => [w.address.toLowerCase(), w.feed as `0x${string}`]))
async function priceE8(token: string): Promise<bigint | null> {
  const feed = feedOf.get(token.toLowerCase())
  if (!feed) return null
  const r = await tryRead(client.readContract({ address: feed, abi: aggAbi, functionName: 'latestRoundData' }))
  return r && r[1] > 0n ? r[1] : null
}

const excluded = defaultExcluded([net.pons.hook, net.uniswapV4.poolManager, net.pons.graduationExecutor, factory])
const burnVault = env.BURN_VAULT_ADDRESS ? (env.BURN_VAULT_ADDRESS as `0x${string}`) : null

async function fetchLogs(from: bigint, to: bigint): Promise<PonsLog[]> {
  const [launched, curve] = await Promise.all([
    client.getLogs({ address: factory!, events: factoryAbi, fromBlock: from, toBlock: to }),
    client.getLogs({ events: curveAbi.filter((x) => x.type === 'event'), fromBlock: from, toBlock: to }),
  ])
  return [...launched, ...curve].flatMap((l) =>
    l.blockNumber === null || l.logIndex === null || l.transactionHash === null ? [] : [l as unknown as PonsLog],
  )
}

/** Token yang transfernya dilacak: token Pons yang baru diluncurkan + token whale. Alamat dipecah per 100 agar getLogs tidak terlalu besar. */
async function fetchTransfers(d: Db, from: bigint, to: bigint): Promise<TransferLog[]> {
  const since = new Date(Date.now() - env.HOLDER_TRACK_DAYS * 86_400_000)
  const recent = await d.select({ a: ponsTokens.address }).from(ponsTokens).where(gte(ponsTokens.launchedAt, since))
  const tokens = [...new Set([...recent.map((r) => r.a), ...whaleCfg.map((w) => getAddress(w.address))])]
  const out: TransferLog[] = []
  for (let i = 0; i < tokens.length; i += 100) {
    const logs = await client.getLogs({ address: tokens.slice(i, i + 100) as `0x${string}`[], event: transferAbi[0], fromBlock: from, toBlock: to })
    for (const l of logs) {
      if (l.blockNumber === null || l.logIndex === null || l.transactionHash === null) continue
      out.push({ token: l.address, from: l.args.from!, to: l.args.to!, value: l.args.value!, blockNumber: l.blockNumber, logIndex: l.logIndex, transactionHash: l.transactionHash })
    }
  }
  return out
}

async function fetchBurns(from: bigint, to: bigint): Promise<BurnLog[]> {
  if (!burnVault) return []
  const logs = await client.getLogs({ address: burnVault, event: burnedAbi[0], fromBlock: from, toBlock: to })
  return logs.flatMap((l) =>
    l.blockNumber === null || l.logIndex === null || l.transactionHash === null
      ? []
      : [{ args: { caller: l.args.caller!, pairSpent: l.args.pairSpent!, nexaBurned: l.args.nexaBurned! }, blockNumber: l.blockNumber, logIndex: l.logIndex, transactionHash: l.transactionHash }],
  )
}

async function tick() {
  const head = await client.getBlockNumber()
  const [state] = await db.select().from(indexerState).where(eq(indexerState.name, STATE))
  const next = state ? state.lastBlock + 1n : (env.INDEXER_START_BLOCK ?? head)
  if (next > head) return
  const to = next + env.INDEXER_CHUNK_BLOCKS - 1n < head ? next + env.INDEXER_CHUNK_BLOCKS - 1n : head

  const ponsLogs = await fetchLogs(next, to)
  const burnLogs = await fetchBurns(next, to)

  // Semua tulis dalam satu transaksi bersama kursor: saldo holder bersifat delta, jadi chunk tidak boleh diterapkan dua kali.
  const r = await db.transaction(async (tx) => {
    const d = tx as unknown as Db
    const pons = await processLogs({ db: d, readMeta, blockTime, highCreatorTaxBps: env.HIGH_CREATOR_TAX_BPS }, ponsLogs)
    const h = await applyTransfers(
      {
        db: d,
        blockTime,
        excluded,
        highCreatorTaxBps: env.HIGH_CREATOR_TAX_BPS,
        concentratedBps: env.HOLDER_CONCENTRATED_BPS,
        whale: whaleTokens.size ? { tokens: whaleTokens, minUsd: env.WHALE_MIN_USD, priceE8 } : undefined,
      },
      await fetchTransfers(d, next, to),
    )
    const burned = await processBurns(d, burnLogs, blockTime)
    await tx
      .insert(indexerState)
      .values({ name: STATE, lastBlock: to })
      .onConflictDoUpdate({ target: indexerState.name, set: { lastBlock: to, updatedAt: new Date() } })
    return { ...pons, ...h, burned }
  })
  if (r.launches || r.trades || r.graduations || r.whales || r.burned)
    console.log(`indexer: blok ${next}-${to}: ${r.launches} launch, ${r.trades} trade, ${r.graduations} graduation, ${r.whales} whale, ${r.burned} burn`)
}

console.log(`indexer: ${env.CHAIN_ENV}, factory ${factory}, whale ${[...whaleTokens.values()].map((w) => w.symbol).join(',') || '-'}, burn vault ${burnVault ?? 'nonaktif'}`)
for (;;) {
  try {
    await tick()
  } catch (e) {
    console.error('indexer: tick gagal:', e instanceof Error ? e.message : e)
  }
  await new Promise((r) => setTimeout(r, env.INDEXER_POLL_SECONDS * 1000))
}
