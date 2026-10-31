import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { burns, createDb, ponsTokens, tokenHolders, whaleTransfers } from '@nexa-ai/db'
import { processBurns } from '../src/burns'
import { applyTransfers, defaultExcluded, type HolderDeps, type TransferLog } from '../src/holders'
import { HOLDERS_CONCENTRATED_FLAG, HIGH_CREATOR_TAX_FLAG, computeRedFlags } from '../src/process'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test holder dilewati')
}

const a = (n: number) => `0x${n.toString(16).padStart(40, '0')}`
const TOKEN = a(0xaa)
const CURVE = a(0xbb)
const POOL = a(0xcc)
const ZERO = a(0)
const [ALICE, BOB, CAROL] = [a(0xd1), a(0xd2), a(0xd3)]
const E18 = 10n ** 18n
const SUPPLY = 1_000_000n * E18
let seq = 0
const tr = (from: string, to: string, value: bigint, over: Partial<TransferLog> = {}): TransferLog => ({
  token: TOKEN, from, to, value, blockNumber: 10n, logIndex: seq++, transactionHash: `0x${(seq + 1000).toString(16).padStart(64, '0')}`, ...over,
})

const NVDA = a(0xe1)
const base = (over: Partial<HolderDeps> = {}): HolderDeps => ({
  db,
  blockTime: async (n) => new Date(Date.UTC(2026, 9, 31, 0, 0, Number(n))),
  excluded: defaultExcluded([POOL]),
  highCreatorTaxBps: 500,
  concentratedBps: 2000,
  ...over,
})

describe('computeRedFlags', () => {
  it('menggabungkan pajak creator dan konsentrasi holder; null = tidak menebak', () => {
    const cfg = { highCreatorTaxBps: 500, concentratedBps: 2000 }
    expect(computeRedFlags({ creatorTaxBps: 100, topHolderShareBps: 1999 }, cfg)).toEqual([])
    expect(computeRedFlags({ creatorTaxBps: 100, topHolderShareBps: 2000 }, cfg)).toEqual([HOLDERS_CONCENTRATED_FLAG])
    expect(computeRedFlags({ creatorTaxBps: 900, topHolderShareBps: 4200 }, cfg)).toEqual([HIGH_CREATOR_TAX_FLAG, HOLDERS_CONCENTRATED_FLAG])
    expect(computeRedFlags({ creatorTaxBps: null, topHolderShareBps: null }, cfg)).toEqual([])
  })
})

describe.skipIf(!dbUp)('applyTransfers', () => {
  beforeEach(async () => {
    seq = 0
    await db.delete(tokenHolders)
    await db.delete(whaleTransfers)
    await db.delete(burns)
    await db.delete(ponsTokens)
    await db.insert(ponsTokens).values({ address: getAddress(TOKEN), curve: CURVE, creator: getAddress(ALICE), name: 'T', symbol: 'TST', launchedAt: new Date(), creatorTaxBps: 100, redFlags: [], blockNumber: 1n })
  })
  afterAll(async () => {
    await client.end()
  })
  const token = async () => (await db.select().from(ponsTokens))[0]!

  it('curve memegang suplai awal: tidak dihitung sebagai holder, konsentrasi mengikuti pembeli terbesar', async () => {
    // mint ke curve, lalu dua pembeli: Alice 25%, Bob 5%
    await applyTransfers(base(), [tr(ZERO, CURVE, SUPPLY), tr(CURVE, ALICE, SUPPLY / 4n), tr(CURVE, BOB, SUPPLY / 20n)])
    const t = await token()
    expect(t.topHolderShareBps).toBe(2500)
    expect(t.redFlags).toEqual([HOLDERS_CONCENTRATED_FLAG])
  })

  it('di bawah ambang: tanpa flag; saldo dilanjutkan antar chunk (delta)', async () => {
    await applyTransfers(base(), [tr(ZERO, CURVE, SUPPLY), tr(CURVE, ALICE, SUPPLY / 10n)])
    expect((await token()).topHolderShareBps).toBe(1000)
    expect((await token()).redFlags).toEqual([])
    // chunk berikutnya: Alice membeli lagi -> 30%
    await applyTransfers(base(), [tr(CURVE, ALICE, (SUPPLY * 2n) / 10n, { blockNumber: 11n })])
    const t = await token()
    expect(t.topHolderShareBps).toBe(3000)
    expect(t.redFlags).toEqual([HOLDERS_CONCENTRATED_FLAG])
  })

  it('flag hilang bila holder menjual; pool, burn, dan curve tidak dihitung', async () => {
    await applyTransfers(base(), [tr(ZERO, CURVE, SUPPLY), tr(CURVE, ALICE, SUPPLY / 2n)])
    expect((await token()).redFlags).toEqual([HOLDERS_CONCENTRATED_FLAG])
    // Alice memindahkan ke pool (liquidity) dan sebagian ke Carol: tidak ada holder biasa di atas 20%
    await applyTransfers(base(), [tr(ALICE, POOL, SUPPLY / 4n), tr(ALICE, CAROL, SUPPLY / 20n), tr(ALICE, a(0xdead), SUPPLY / 20n)])
    const t = await token()
    expect(t.topHolderShareBps).toBe(1500) // sisa Alice 15%
    expect(t.redFlags).toEqual([])
  })

  it('riwayat tidak lengkap (saldo negatif): konsentrasi null, tidak ditebak', async () => {
    await applyTransfers(base(), [tr(ALICE, BOB, 5n * E18)]) // tanpa mint: Alice -5
    expect((await token()).topHolderShareBps).toBeNull()
  })

  it('token yang tidak dikenal diabaikan', async () => {
    const r = await applyTransfers(base(), [tr(ZERO, ALICE, E18, { token: a(0x99) })])
    expect(r.holderTokens).toBe(0)
    expect(await db.select().from(tokenHolders)).toHaveLength(0)
  })

  describe('transfer whale', () => {
    const whale = (price: bigint | null): HolderDeps['whale'] => ({
      tokens: new Map([[NVDA, { symbol: 'NVDA', decimals: 18 }]]),
      minUsd: 100_000,
      priceE8: async () => price,
    })
    const nvda = (value: bigint, over: Partial<TransferLog> = {}) => tr(ALICE, BOB, value, { token: NVDA, ...over })

    it('mencatat transfer >= ambang USD; yang kecil, atau tanpa harga, tidak', async () => {
      const p = 20_528_000_000n // $205,28
      // 500 NVDA = $102.640 (lolos), 100 NVDA = $20.528 (tidak)
      const r = await applyTransfers(base({ whale: whale(p) }), [nvda(500n * E18), nvda(100n * E18)])
      expect(r.whales).toBe(1)
      const [w] = await db.select().from(whaleTransfers)
      expect(w).toMatchObject({ token: getAddress(NVDA), amount: (500n * E18).toString(), decimals: 18 })
      expect((await applyTransfers(base({ whale: whale(null) }), [nvda(10_000n * E18)])).whales).toBe(0)
    })

    it('idempoten per transfer', async () => {
      const t = nvda(1_000n * E18)
      await applyTransfers(base({ whale: whale(20_528_000_000n) }), [t])
      expect((await applyTransfers(base({ whale: whale(20_528_000_000n) }), [t])).whales).toBe(0)
      expect(await db.select().from(whaleTransfers)).toHaveLength(1)
    })
  })

  describe('BurnVault Burned', () => {
    const log = (n: number) => ({ args: { caller: ALICE, pairSpent: 5n * E18, nexaBurned: 1_000n * E18 }, blockNumber: 10n, logIndex: n, transactionHash: `0x${'ab'.repeat(32)}` })
    it('mengisi tabel burns (dibaca /burn), idempoten', async () => {
      const bt = async () => new Date('2026-10-31T00:00:00Z')
      expect(await processBurns(db, [log(0), log(1)], bt)).toBe(2)
      expect(await processBurns(db, [log(0)], bt)).toBe(0)
      const rows = await db.select().from(burns)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ nexaBurned: (1_000n * E18).toString(), pairSpent: (5n * E18).toString() })
    })
  })
})
