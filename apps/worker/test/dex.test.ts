import { describe, expect, it } from 'vitest'
import { numberToHex, type Address, type Hex } from 'viem'
import {
  MAX_PLAUSIBLE_GAP_BPS,
  assetPriceE8,
  decodeSlot0,
  dexGapBps,
  discoverPools,
  makeDexSource,
  poolStateSlot,
  quoteAsset,
  usdgDepthRaw,
  type DexClient,
  type DexConfig,
} from '../src/dex'

const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as Address // lebih kecil dari NVDA: USDG = currency0
const NVDA = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' as Address
const Q96 = 1n << 96n
const id = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex
const word = (n: bigint): Hex => numberToHex(n, { size: 32 })

/** sqrtPriceX96 untuk harga mentah (token1 per token0) tertentu, dari float (cukup untuk uji toleransi). */
const sqrtFor = (rawPrice: number) => BigInt(Math.floor(Math.sqrt(rawPrice) * 2 ** 48)) * 2n ** 48n

/** USDG = currency0 (6 desimal), NVDA = currency1 (18): harga mentah = NVDA_raw per USDG_raw. */
const sqrtNvdaUsd = (usd: number) => sqrtFor(1e12 / usd)

const packSlot0 = (sqrtP: bigint, tick: number) => sqrtP | (BigInt(tick & 0xffffff) << 160n) | (0n << 184n) | (3000n << 208n)

describe('decodeSlot0', () => {
  it('sqrtPriceX96 dan tick (positif dan negatif, bertanda 24 bit); bit fee tidak mengganggu', () => {
    expect(decodeSlot0(word(packSlot0(79228162514264337593543950336n, 222_714)))).toEqual({ sqrtPriceX96: 79228162514264337593543950336n, tick: 222_714 })
    expect(decodeSlot0(word(packSlot0(1234n, -10))).tick).toBe(-10)
    expect(decodeSlot0(word(packSlot0(1n, -8_388_608))).tick).toBe(-8_388_608)
    expect(decodeSlot0(word(packSlot0(1n, 8_388_607))).tick).toBe(8_388_607)
  })
})

describe('poolStateSlot', () => {
  it('deterministik per pool dan berbeda antar pool', () => {
    expect(poolStateSlot(id(1))).toBe(poolStateSlot(id(1)))
    expect(poolStateSlot(id(1))).not.toBe(poolStateSlot(id(2)))
  })
})

describe('harga dan kedalaman', () => {
  it('assetPriceE8: USDG = currency0 memberi harga USD per NVDA (toleransi float)', () => {
    const p = assetPriceE8(sqrtNvdaUsd(205.02), 18, 6, true)
    expect(Number(p) / 1e8).toBeCloseTo(205.02, 4)
  })

  it('assetPriceE8: USDG = currency1 (urutan terbalik) menghasilkan harga yang sama', () => {
    // harga mentah = USDG_raw per asset_raw = 205.02 * 1e6 / 1e18
    const p = assetPriceE8(sqrtFor((205.02 * 1e6) / 1e18), 18, 6, false)
    expect(Number(p) / 1e8).toBeCloseTo(205.02, 4)
  })

  it('sqrtPrice nol = harga nol (tidak membagi nol)', () => {
    expect(assetPriceE8(0n, 18, 6, true)).toBe(0n)
    expect(usdgDepthRaw({ sqrtPriceX96: 0n, liquidity: 10n }, true)).toBe(0n)
  })

  it('usdgDepthRaw: x = L / sqrtP (USDG = currency0), y = L * sqrtP (USDG = currency1)', () => {
    const s = { sqrtPriceX96: 2n * Q96, liquidity: 1000n }
    expect(usdgDepthRaw(s, true)).toBe(500n)
    expect(usdgDepthRaw(s, false)).toBe(2000n)
  })

  it('dexGapBps: bilangan bulat dibulatkan ke nol, positif = DEX di atas oracle, desimal oracle dinormalkan', () => {
    expect(dexGapBps(20_502_000_000n, 20_528_000_142n, 8)).toBe(-12) // -0,1266% -> -12
    expect(dexGapBps(20_600_000_000n, 20_000_000_000n, 8)).toBe(300)
    expect(dexGapBps(20_000_000_000n, 200_000_000n, 6)).toBe(0) // oracle 6 desimal setara $200
    expect(dexGapBps(0n, 20_000_000_000n, 8)).toBeNull()
    expect(dexGapBps(20_000_000_000n, 0n, 8)).toBeNull()
    expect(MAX_PLAUSIBLE_GAP_BPS).toBe(2000)
  })
})

interface FakePool {
  usd: number
  liquidity: bigint
}

/** Klien palsu: pool disimpan menurut slot storage yang sama dengan PoolManager asli. */
function fakeClient(pools: Record<number, FakePool>, opts: { broken?: number[]; scanned?: { windows: number } } = {}): DexClient {
  const storage = new Map<string, Hex>()
  for (const [k, p] of Object.entries(pools)) {
    const base = poolStateSlot(id(Number(k)))
    storage.set(word(base), word(packSlot0(sqrtNvdaUsd(p.usd), 222_000)))
    storage.set(word(base + 3n), word(p.liquidity))
  }
  const broken = new Set((opts.broken ?? []).map((n) => word(poolStateSlot(id(n)))))
  return {
    head: async () => 20_000_000n,
    initializedPools: async (_c0, _c1, from) => {
      if (opts.scanned) opts.scanned.windows++
      return from === 0n ? Object.keys(pools).map((k) => id(Number(k))) : []
    },
    extsload: async (slot) => {
      if (broken.has(slot)) throw new Error('rpc')
      return storage.get(slot) ?? word(0n)
    },
    decimals: async () => 18,
  }
}

const cfg: DexConfig = { usdg: USDG, usdgDecimals: 6, minDepthUsdg: 1000 }
// kedalaman (USDG) ~ L / sqrtP: untuk harga ~$205, sqrtP ~ 2,2e6 * Q96/... gunakan L besar agar jelas
const deep = 3_000_000_000_000_000_000n
const shallow = 3_000_000_000_000n

describe('quoteAsset', () => {
  it('memilih pool dengan kedalaman terbesar dan memberi harganya', async () => {
    const c = fakeClient({ 1: { usd: 150, liquidity: shallow * 10_000n }, 2: { usd: 205.02, liquidity: deep }, 3: { usd: 190, liquidity: deep / 3n } })
    const q = await quoteAsset(c, cfg, NVDA)
    expect(q?.poolId).toBe(id(2))
    expect(Number(q!.priceE8) / 1e8).toBeCloseTo(205.02, 3)
    expect(q!.poolsChecked).toBe(3)
  })

  it('pool tanpa likuiditas, tidak terbaca, atau di bawah kedalaman minimum diabaikan', async () => {
    const c = fakeClient({ 1: { usd: 205, liquidity: 0n }, 2: { usd: 100, liquidity: deep }, 3: { usd: 205.02, liquidity: deep / 2n }, 4: { usd: 205, liquidity: 1n } }, { broken: [2] })
    const q = await quoteAsset(c, cfg, NVDA)
    expect(q?.poolId).toBe(id(3)) // 2 gagal dibaca, 1 dan 4 terlalu tipis
  })

  it('tidak ada pool yang cukup dalam = null (tidak menebak)', async () => {
    expect(await quoteAsset(fakeClient({ 1: { usd: 205, liquidity: 1n } }), cfg, NVDA)).toBeNull()
    expect(await quoteAsset(fakeClient({}), cfg, NVDA)).toBeNull()
  })

  it('poolIdOverride mengunci pool tanpa pemindaian', async () => {
    const scanned = { windows: 0 }
    const c = fakeClient({ 1: { usd: 205.02, liquidity: deep }, 2: { usd: 100, liquidity: deep * 5n } }, { scanned })
    const q = await quoteAsset(c, { ...cfg, poolIdOverride: id(1) }, NVDA)
    expect(q?.poolId).toBe(id(1))
    expect(scanned.windows).toBe(0)
  })
})

describe('discoverPools', () => {
  it('memindai seluruh riwayat per jendela dan membuang duplikat', async () => {
    const scanned = { windows: 0 }
    const c = fakeClient({ 1: { usd: 205, liquidity: 1n }, 2: { usd: 205, liquidity: 1n } }, { scanned })
    const ids = await discoverPools(c, NVDA, USDG, 9_000_000n)
    expect(ids.sort()).toEqual([id(1), id(2)])
    expect(scanned.windows).toBe(3) // head 20 juta / jendela 9 juta
  })
})

describe('makeDexSource', () => {
  it('daftar pool di-cache selama TTL; setelahnya dipindai ulang; hasil tidak membocorkan daftar internal', async () => {
    const scanned = { windows: 0 }
    const c = fakeClient({ 1: { usd: 205.02, liquidity: deep } }, { scanned })
    let t = 0
    const src = makeDexSource(c, cfg, 1000, () => t)
    const a = await src(NVDA)
    expect(a).toBeTruthy()
    expect('pools' in a!).toBe(false)
    const after1 = scanned.windows
    await src(NVDA)
    expect(scanned.windows).toBe(after1) // cache
    t = 2000
    await src(NVDA)
    expect(scanned.windows).toBeGreaterThan(after1) // kedaluwarsa
  })
})
