import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, ponsTokens, ponsTrades } from '@nexa-ai/db'
import { HIGH_CREATOR_TAX_FLAG, processLogs, redFlagsFor, type PonsLog, type ProcessDeps } from '../src/process'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test indexer dilewati')
}

const TOKEN = '0x00000000000000000000000000000000000000aa'
const CURVE = '0x00000000000000000000000000000000000000bb'
const PAIR = '0x00000000000000000000000000000000000000cc'
const ALICE = '0x00000000000000000000000000000000000000d1'
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}`

const deps = (tax: number | null): ProcessDeps => ({
  db,
  readMeta: async () => ({ name: 'Test', symbol: 'TST', creatorTaxBps: tax, pairDecimals: 6 }),
  blockTime: async (n) => new Date(Date.UTC(2026, 9, 31, 0, 0, Number(n))),
  highCreatorTaxBps: 500,
})

const launch: PonsLog = {
  eventName: 'TokenLaunched',
  args: { token: TOKEN, curve: CURVE, deployer: ALICE, pairToken: PAIR },
  blockNumber: 10n,
  logIndex: 0,
  transactionHash: tx(1),
}
const buy: PonsLog = {
  eventName: 'CurveBuy',
  args: { buyer: ALICE, quoteIn: 5_000_000n, tokensOut: 10n ** 18n },
  address: CURVE,
  blockNumber: 11n,
  logIndex: 0,
  transactionHash: tx(2),
}
const sell: PonsLog = {
  eventName: 'CurveSell',
  args: { seller: ALICE, tokensIn: 5n * 10n ** 17n, quoteOut: 2_000_000n },
  address: CURVE,
  blockNumber: 12n,
  logIndex: 3,
  transactionHash: tx(3),
}

describe('redFlagsFor', () => {
  it('menandai hanya di atas ambang; tidak menebak bila pajak tidak terbaca', () => {
    expect(redFlagsFor(500, 500)).toEqual([])
    expect(redFlagsFor(501, 500)).toEqual([HIGH_CREATOR_TAX_FLAG])
    expect(redFlagsFor(null, 500)).toEqual([])
  })
})

describe.skipIf(!dbUp)('processLogs', () => {
  beforeEach(async () => {
    await db.delete(ponsTrades)
    await db.delete(ponsTokens)
  })
  afterAll(async () => {
    await client.end()
  })

  it('menyimpan launch dan trade (urutan log dibalik pun benar)', async () => {
    const r = await processLogs(deps(100), [sell, buy, launch])
    expect(r).toEqual({ launches: 1, trades: 2, graduations: 0 })
    const [t] = await db.select().from(ponsTokens)
    expect(t).toMatchObject({ symbol: 'TST', creatorTaxBps: 100, redFlags: [], blockNumber: 10n })
    expect(t!.curve).toBe(CURVE)
    const trades = await db.select().from(ponsTrades)
    expect(trades.find((x) => x.side === 'buy')).toMatchObject({
      tokenAmount: (10n ** 18n).toString(),
      quoteAmount: '5000000',
      quoteDecimals: 6,
    })
    expect(trades.find((x) => x.side === 'sell')!.quoteAmount).toBe('2000000')
  })

  it('creator tax tinggi -> red flag', async () => {
    await processLogs(deps(1500), [launch])
    const [t] = await db.select().from(ponsTokens)
    expect(t!.redFlags).toEqual([HIGH_CREATOR_TAX_FLAG])
  })

  it('idempoten: diproses dua kali tidak menggandakan', async () => {
    await processLogs(deps(0), [launch, buy])
    const r = await processLogs(deps(0), [launch, buy])
    expect(r).toEqual({ launches: 0, trades: 0, graduations: 0 })
    expect(await db.select().from(ponsTrades)).toHaveLength(1)
  })

  it('CurveCompleted menandai graduation sekali, dengan waktu blok event', async () => {
    const done: PonsLog = { eventName: 'CurveCompleted', args: { token: TOKEN }, address: CURVE, blockNumber: 20n, logIndex: 1, transactionHash: tx(9) }
    expect((await processLogs(deps(0), [launch, buy, done])).graduations).toBe(1)
    const [t] = await db.select().from(ponsTokens)
    expect(t!.graduatedAt!.toISOString()).toBe(new Date(Date.UTC(2026, 9, 31, 0, 0, 20)).toISOString())
    // diproses lagi dengan blok berbeda: tidak menimpa
    expect((await processLogs(deps(0), [{ ...done, blockNumber: 99n, transactionHash: tx(10) }])).graduations).toBe(0)
    expect((await db.select().from(ponsTokens))[0]!.graduatedAt!.getTime()).toBe(t!.graduatedAt!.getTime())
  })

  it('trade dari curve tak dikenal diabaikan', async () => {
    const r = await processLogs(deps(0), [{ ...buy, address: '0x00000000000000000000000000000000000000ee' }])
    expect(r.trades).toBe(0)
  })
})
