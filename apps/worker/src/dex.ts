import { createPublicClient, encodeAbiParameters, hexToBigInt, http, keccak256, numberToHex, parseAbi, parseAbiItem, type Address, type Hex } from 'viem'

/**
 * Harga DEX Stock Token dari pool Uniswap v4 (PoolManager) tanpa kontrak periferal: PoolKey ditemukan dari event
 * `Initialize`, kedalaman dan harga dibaca dari storage PoolManager (`extsload`, sama dengan StateLibrary v4).
 * Hasilnya hanya dipakai untuk membandingkan dengan oracle Chainlink; data yang tidak masuk akal menjadi null (tidak ditebak).
 */

/** `mapping(PoolId => Pool.State) _pools` berada di slot 6 PoolManager (StateLibrary.POOLS_SLOT). */
export const POOLS_SLOT = 6n
const Q96 = 1n << 96n
const MASK_160 = (1n << 160n) - 1n

export const initializeEvent = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)',
)
const managerAbi = parseAbi(['function extsload(bytes32 slot) view returns (bytes32)'])
const erc20Abi = parseAbi(['function decimals() view returns (uint8)'])

/** Slot dasar `Pool.State` suatu pool: keccak256(abi.encode(poolId, POOLS_SLOT)). */
export const poolStateSlot = (poolId: Hex): bigint => hexToBigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [poolId, POOLS_SLOT])))

const word = (n: bigint): Hex => numberToHex(n, { size: 32 })

export interface Slot0 {
  sqrtPriceX96: bigint
  tick: number
}

/** slot0 (dari bit terendah): sqrtPriceX96 (160) | tick (24, bertanda) | protocolFee (24) | lpFee (24). */
export function decodeSlot0(w: Hex): Slot0 {
  const v = hexToBigInt(w)
  const sqrtPriceX96 = v & MASK_160
  let tick = Number((v >> 160n) & 0xffffffn)
  if (tick >= 1 << 23) tick -= 1 << 24
  return { sqrtPriceX96, tick }
}

export interface DexClient {
  head(): Promise<bigint>
  /** Id pool yang diinisialisasi dengan pasangan mata uang ini (currency0 < currency1) pada rentang blok. */
  initializedPools(currency0: Address, currency1: Address, fromBlock: bigint, toBlock: bigint): Promise<Hex[]>
  extsload(slot: Hex): Promise<Hex>
  decimals(token: Address): Promise<number>
}

/** Klien nyata. RPC membatasi satu `getLogs` (10 juta blok di RPC Robinhood), jadi pemindaian dipecah per jendela. */
export function createDexClient(rpcUrl: string, poolManager: Address): DexClient {
  // Timeout 30 dtk (bawaan viem 10 dtk): getLogs pada jendela 9 juta blok bisa lambat dari server hosting.
  const pub = createPublicClient({ transport: http(rpcUrl, { timeout: 30_000, retryCount: 3 }) })
  return {
    head: () => pub.getBlockNumber(),
    async initializedPools(currency0, currency1, fromBlock, toBlock) {
      const logs = await pub.getLogs({ address: poolManager, event: initializeEvent, args: { currency0, currency1 }, fromBlock, toBlock })
      return logs.map((l) => l.args.id!)
    },
    extsload: (slot) => pub.readContract({ address: poolManager, abi: managerAbi, functionName: 'extsload', args: [slot] }),
    decimals: (token) => pub.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
  }
}

/** Semua pool asset/USDG (urutan mata uang v4: alamat lebih kecil = currency0). */
export async function discoverPools(c: DexClient, asset: Address, usdg: Address, windowBlocks = 9_000_000n): Promise<Hex[]> {
  const [c0, c1] = BigInt(usdg) < BigInt(asset) ? [usdg, asset] : [asset, usdg]
  const head = await c.head()
  const ids: Hex[] = []
  for (let to = head; ; to -= windowBlocks) {
    const from = to - windowBlocks + 1n > 0n ? to - windowBlocks + 1n : 0n
    ids.push(...(await c.initializedPools(c0, c1, from, to)))
    if (from === 0n) break
  }
  return [...new Set(ids)]
}

export interface PoolSnapshot {
  poolId: Hex
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
}

export async function readPool(c: DexClient, poolId: Hex): Promise<PoolSnapshot> {
  const base = poolStateSlot(poolId)
  const [s0, liq] = await Promise.all([c.extsload(word(base)), c.extsload(word(base + 3n))])
  const slot0 = decodeSlot0(s0)
  return { poolId, ...slot0, liquidity: hexToBigInt(liq) & ((1n << 128n) - 1n) }
}

/**
 * Kedalaman virtual dalam unit terkecil USDG pada harga saat ini (likuiditas yang berlaku di tick sekarang):
 * x = L / sqrtP bila USDG = currency0, y = L * sqrtP bila USDG = currency1. Dipakai hanya untuk memilih pool.
 */
export function usdgDepthRaw(s: Pick<PoolSnapshot, 'sqrtPriceX96' | 'liquidity'>, usdgIsCurrency0: boolean): bigint {
  if (s.sqrtPriceX96 === 0n) return 0n
  return usdgIsCurrency0 ? (s.liquidity * Q96) / s.sqrtPriceX96 : (s.liquidity * s.sqrtPriceX96) / Q96
}

const pow10 = (n: number) => 10n ** BigInt(n)

/** Harga 1 token asset dalam USD dengan 8 desimal, dengan USDG dianggap $1. Dari bigint (tanpa float). */
export function assetPriceE8(sqrtPriceX96: bigint, assetDecimals: number, usdgDecimals: number, usdgIsCurrency0: boolean): bigint {
  if (sqrtPriceX96 === 0n) return 0n
  const e = 8 + assetDecimals - usdgDecimals // skala dari unit terkecil ke USD e8
  const scale = (n: bigint) => (e >= 0 ? n * pow10(e) : n / pow10(-e))
  const sq = sqrtPriceX96 * sqrtPriceX96
  // USDG = currency0: harga (token1/token0) = (sqrtP/Q96)^2 = asset per USDG, jadi USDG per asset = Q96^2 / sqrtP^2.
  // USDG = currency1: harga = sqrtP^2 / Q96^2 = USDG per asset.
  return usdgIsCurrency0 ? scale(Q96 * Q96) / sq : scale(sq) / (Q96 * Q96)
}

export interface DexQuote {
  priceE8: bigint
  poolId: Hex
  /** Kedalaman virtual pool terpilih, dalam USDG utuh. */
  depthUsdg: string
  /** Jumlah pool asset/USDG yang diperiksa. */
  poolsChecked: number
}

export interface DexConfig {
  usdg: Address
  usdgDecimals: number
  /** Kedalaman minimum (USDG utuh) agar pool dianggap pasar yang berarti. */
  minDepthUsdg: number
  /** Kunci pool tertentu (lewati pemindaian dan pemilihan). */
  poolIdOverride?: Hex
}

/** Menjalankan `fn` pada setiap item dengan paralelisme terbatas (RPC publik tidak untuk ratusan permintaan serentak). */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

/**
 * Harga DEX satu aset: pool asset/USDG dengan kedalaman terbesar (minimal `minDepthUsdg`). Null bila tidak ada pool,
 * tidak ada yang cukup dalam, atau data tidak terbaca. Pool yang gagal dibaca dilewati.
 */
export async function quoteAsset(c: DexClient, cfg: DexConfig, asset: Address, knownPools?: Hex[]): Promise<(DexQuote & { pools: Hex[] }) | null> {
  const usdgIsCurrency0 = BigInt(cfg.usdg) < BigInt(asset)
  const pools = cfg.poolIdOverride ? [cfg.poolIdOverride] : (knownPools ?? (await discoverPools(c, asset, cfg.usdg)))
  if (pools.length === 0) return null

  const assetDecimals = await c.decimals(asset)
  const snaps = (
    await mapLimit(pools, 16, async (id) => {
      try {
        return await readPool(c, id)
      } catch {
        return null
      }
    })
  ).filter((s): s is PoolSnapshot => s !== null && s.sqrtPriceX96 > 0n && s.liquidity > 0n)

  const min = BigInt(cfg.minDepthUsdg) * pow10(cfg.usdgDecimals)
  let best: { snap: PoolSnapshot; depth: bigint } | null = null
  for (const s of snaps) {
    const depth = usdgDepthRaw(s, usdgIsCurrency0)
    if (depth >= min && (!best || depth > best.depth)) best = { snap: s, depth }
  }
  if (!best) return null
  const priceE8 = assetPriceE8(best.snap.sqrtPriceX96, assetDecimals, cfg.usdgDecimals, usdgIsCurrency0)
  if (priceE8 <= 0n) return null
  return { priceE8, poolId: best.snap.poolId, depthUsdg: (best.depth / pow10(cfg.usdgDecimals)).toString(), poolsChecked: snaps.length, pools }
}

/** Selisih DEX terhadap oracle dalam bps (bilangan bulat, dibulatkan ke nol). Positif = DEX di atas oracle. */
export function dexGapBps(dexPriceE8: bigint, oracleAnswer: bigint, oracleDecimals: number): number | null {
  if (oracleAnswer <= 0n || dexPriceE8 <= 0n) return null
  const oracleE8 = oracleDecimals >= 8 ? oracleAnswer / pow10(oracleDecimals - 8) : oracleAnswer * pow10(8 - oracleDecimals)
  if (oracleE8 <= 0n) return null
  return Number(((dexPriceE8 - oracleE8) * 10_000n) / oracleE8)
}

/** Selisih lebih dari ini dianggap data DEX tidak wajar (pool tipis/terdistorsi) dan dibuang, bukan dilaporkan. */
export const MAX_PLAUSIBLE_GAP_BPS = 2000


/**
 * Sumber kuotasi DEX untuk worker: daftar pool per aset di-cache 24 jam (pemindaian event butuh belasan permintaan RPC),
 * sedangkan kedalaman dan harga dibaca ulang setiap panggilan. Gagal = null (ringkasan tidak membahas DEX).
 */
export type DexSource = (asset: Address) => Promise<DexQuote | null>

export function makeDexSource(c: DexClient, cfg: DexConfig, ttlMs = 24 * 3_600_000, now: () => number = Date.now): DexSource {
  const cache = new Map<string, { pools: Hex[]; at: number }>()
  return async (asset) => {
    const key = asset.toLowerCase()
    const hit = cache.get(key)
    const known = hit && now() - hit.at < ttlMs ? hit.pools : undefined
    const q = await quoteAsset(c, cfg, asset, known)
    if (!q) return null
    if (!known) cache.set(key, { pools: q.pools, at: now() })
    const { pools: _pools, ...quote } = q
    return quote
  }
}
