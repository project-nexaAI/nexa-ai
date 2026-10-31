import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, kolAccounts, kolCalls } from '@nexa-ai/db'
import { addCall, addKol, scoreDueKolCalls } from '../src/kol'
import type { FeedReader, OracleAsset } from '../src/oracle'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test KOL dilewati')
}

const FEED = '0x00000000000000000000000000000000000000f1'
const asset: OracleAsset = { symbol: 'NVDA', asset: '0x00000000000000000000000000000000000000a1', feed: FEED }
const T0 = new Date('2026-12-01T00:00:00.000Z')
const sec = (d: Date) => BigInt(Math.floor(d.getTime() / 1000))
const reader =
  (answer: bigint, updatedAt: Date): FeedReader =>
  async () => ({ answer, decimals: 8, updatedAt: sec(updatedAt) })
const LINK = 'https://x.com/someone/status/123'

describe.skipIf(!dbUp)('KOL', () => {
  beforeEach(async () => {
    await db.delete(kolCalls)
    await db.delete(kolAccounts)
    await addKol(db, '@SomeOne', 'Some One')
  })
  afterAll(async () => {
    await client.end()
  })
  const call = (over: Partial<Parameters<typeof addCall>[2]> = {}, read = reader(10_000_000_000n, T0)) =>
    addCall(db, read, { handle: 'someone', asset, direction: 'up', horizonDays: 7, sourceUrl: LINK, text: 'NVDA up', ...over }, T0)

  it('handle dinormalkan; handle tidak valid ditolak', async () => {
    const [k] = await db.select().from(kolAccounts)
    expect(k!.handle).toBe('someone')
    await expect(addKol(db, 'bad handle!', 'x')).rejects.toThrow()
  })

  it('addCall: mencatat harga awal dari oracle dan jatuh tempo; menolak KOL tak dikenal, link bukan X, harga basi', async () => {
    const c = await call()
    expect(c).toMatchObject({ startPrice: '10000000000', priceDecimals: 8, direction: 1 })
    expect(c.maturesAt.toISOString()).toBe('2026-12-08T00:00:00.000Z')
    await expect(call({ handle: 'tidakada' })).rejects.toThrow(/belum terdaftar/)
    await expect(call({ sourceUrl: 'https://evil.test/x' })).rejects.toThrow(/link post X/)
    await expect(call({}, reader(10_000_000_000n, new Date(T0.getTime() - 4 * 86_400_000)))).rejects.toThrow(/tidak segar/)
  })

  it('scoreDueKolCalls: aturan ledger setelah jatuh tempo; belum jatuh tempo atau round basi dilewati', async () => {
    await call() // up, awal 100
    const after = new Date('2026-12-08T06:00:00.000Z')
    const early = new Date('2026-12-07T12:00:00Z')
    expect(await scoreDueKolCalls(db, reader(10_500_000_000n, new Date('2026-12-07T00:00:00Z')), [asset], early)).toEqual({ scored: 0, skipped: 0 })
    expect(await scoreDueKolCalls(db, reader(10_500_000_000n, new Date('2026-12-07T23:00:00Z')), [asset], after)).toEqual({ scored: 0, skipped: 1 })
    expect(await scoreDueKolCalls(db, reader(10_500_000_000n, new Date('2026-12-08T05:00:00Z')), [asset], after)).toEqual({ scored: 1, skipped: 0 })
    const [c] = await db.select().from(kolCalls)
    expect(c).toMatchObject({ won: true, returnBps: 500, endPrice: '10500000000' })
    expect(await scoreDueKolCalls(db, reader(1n, after), [asset], after)).toEqual({ scored: 0, skipped: 0 })
  })

  it('call turun yang benar menang dengan return mentah negatif', async () => {
    await call({ direction: 'down' })
    await scoreDueKolCalls(db, reader(9_000_000_000n, new Date('2026-12-08T01:00:00Z')), [asset], new Date('2026-12-08T02:00:00Z'))
    const [c] = await db.select().from(kolCalls)
    expect(c).toMatchObject({ won: true, returnBps: -1000 })
  })
})
