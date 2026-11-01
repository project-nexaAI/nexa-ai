import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { asc } from 'drizzle-orm'
import { createDb, priceSnapshots } from '@nexa-ai/db'
import { recordMarketSnapshots, type MarketDeps } from '../src/market'
import type { FeedHistory } from '../src/oracle'

const { db, client } = createDb(process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test')
afterAll(async () => {
  await client.end()
})

const NOW = new Date('2026-11-01T12:00:00.000Z')
const nowSec = BigInt(NOW.getTime() / 1000)
const NVDA = { symbol: 'NVDA', asset: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', feed: '0x1111111111111111111111111111111111111111' } as const
const ETH = { symbol: 'ETH', asset: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', feed: '0x2222222222222222222222222222222222222222' } as const

const history = (answers: Record<string, { answer: bigint; updatedAt?: bigint } | 'fail'>): FeedHistory => ({
  latest: async (feed) => {
    const a = answers[feed]
    if (!a || a === 'fail') throw new Error('rpc')
    return { roundId: 7n, answer: a.answer, updatedAt: a.updatedAt ?? nowSec - 60n, decimals: 8 }
  },
  round: async () => null,
})

const deps = (over: Partial<MarketDeps>): MarketDeps => ({ db, history: history({}), assets: [NVDA], retentionMs: 8 * 24 * 3600_000, ...over })
const rows = () => db.select().from(priceSnapshots).orderBy(asc(priceSnapshots.id))

describe('recordMarketSnapshots', () => {
  beforeEach(async () => {
    await db.delete(priceSnapshots)
  })

  it('mencatat oracle dan DEX dengan waktu yang sama', async () => {
    const dex = async () => ({ priceE8: 20_450_000_000n, poolId: '0x00' as `0x${string}`, depthUsdg: '9999', poolsChecked: 1 })
    const r = await recordMarketSnapshots(deps({ history: history({ [NVDA.feed]: { answer: 20_528_000_142n } }), dex }), NOW)
    expect(r).toEqual({ oracle: 1, dex: 1 })
    const all = await rows()
    expect(all.map((x) => [x.asset, x.source, x.price, x.decimals])).toEqual([
      ['NVDA', 'oracle', '20528000142', 8],
      ['NVDA', 'dex', '20450000000', 8],
    ])
    expect(all[0]!.roundId).toBe('7')
    expect(all[0]!.at.getTime()).toBe(all[1]!.at.getTime())
  })

  it('selisih tidak wajar (> 20%), DEX null, atau DEX gagal: hanya oracle', async () => {
    const h = history({ [NVDA.feed]: { answer: 20_000_000_000n } })
    const quote = (p: bigint) => async () => ({ priceE8: p, poolId: '0x00' as `0x${string}`, depthUsdg: '1', poolsChecked: 1 })
    await recordMarketSnapshots(deps({ history: h, dex: quote(10_000_000_000n) }), NOW)
    await recordMarketSnapshots(deps({ history: h, dex: async () => null }), NOW)
    await recordMarketSnapshots(deps({ history: h, dex: async () => { throw new Error('rpc') } }), NOW)
    expect((await rows()).map((x) => x.source)).toEqual(['oracle', 'oracle', 'oracle'])
  })

  it('feed gagal atau basi dilewati; aset lain tetap tercatat', async () => {
    const stale = nowSec - BigInt(5 * 24 * 3600)
    const r = await recordMarketSnapshots(
      deps({ assets: [NVDA, ETH], history: history({ [NVDA.feed]: { answer: 20_000_000_000n, updatedAt: stale }, [ETH.feed]: { answer: 226_000_000_000n } }) }),
      NOW,
    )
    expect(r.oracle).toBe(1)
    expect((await rows()).map((x) => x.asset)).toEqual(['ETH'])
    expect((await recordMarketSnapshots(deps({ assets: [ETH], history: history({ [ETH.feed]: 'fail' }) }), NOW)).oracle).toBe(0)
  })

  it('snapshot lebih tua dari retensi dihapus', async () => {
    const old = new Date(NOW.getTime() - 9 * 24 * 3600_000)
    await db.insert(priceSnapshots).values({ asset: 'NVDA', source: 'oracle', price: '1', decimals: 8, at: old })
    await recordMarketSnapshots(deps({ history: history({ [NVDA.feed]: { answer: 20_000_000_000n } }) }), NOW)
    expect((await rows()).filter((x) => x.at.getTime() === old.getTime())).toHaveLength(0)
  })
})
