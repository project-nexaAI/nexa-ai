import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, getAddress, parseAbi } from 'viem'
import { askPayments, createDb, ponsTokens, ponsTrades } from '@nexa-ai/db'
import { askResponseSchema } from '@nexa-ai/api-client'
import { buildApp } from '../src/app'
import type { AskConfig } from '../src/ask'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test /ask dilewati')
}

const NOW = new Date('2026-12-01T12:00:00.000Z')
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const
const TREASURY = '0x00000000000000000000000000000000000000a1' as const
const PAYER = '0x00000000000000000000000000000000000000b2' as const
const TOKEN = '0x00000000000000000000000000000000000000c3'
const OTHER = '0x00000000000000000000000000000000000000d4'
const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`
const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

const transferLog = (token: `0x${string}`, to: `0x${string}`, value: bigint) => ({
  address: token,
  topics: encodeEventTopics({ abi: transferAbi, eventName: 'Transfer', args: { from: PAYER, to } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  blockHash: h(1),
  blockNumber: 1n,
  logIndex: 0,
  transactionHash: h(2),
  transactionIndex: 0,
  removed: false,
})

/** Receipt palsu per tx hash; hash tak dikenal = tx tidak ditemukan. */
function fakeClient(receipts: Record<string, { status: 'success' | 'reverted'; logs: ReturnType<typeof transferLog>[] }>): AskConfig['client'] {
  return {
    getTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) => {
      const r = receipts[hash]
      if (!r) throw new Error('not found')
      return r
    },
  } as unknown as AskConfig['client']
}

const receipts = {
  [h(10)]: { status: 'success' as const, logs: [transferLog(USDG, TREASURY, 1_000_000n)] },
  [h(11)]: { status: 'success' as const, logs: [transferLog(USDG, TREASURY, 999_999n)] },
  [h(12)]: { status: 'success' as const, logs: [transferLog(OTHER as `0x${string}`, TREASURY, 5_000_000n)] }, // token palsu
  [h(13)]: { status: 'success' as const, logs: [transferLog(USDG, PAYER, 5_000_000n)] }, // bukan ke penerima
  [h(14)]: { status: 'reverted' as const, logs: [transferLog(USDG, TREASURY, 1_000_000n)] },
  [h(15)]: { status: 'success' as const, logs: [transferLog(USDG, TREASURY, 1_000_000n)] },
}

const mk = (paid = true, withAsk = true) =>
  buildApp({
    db,
    explorerUrl: 'https://explorer.example.test',
    paidFeaturesEnabled: paid,
    now: () => NOW,
    ...(withAsk ? { ask: { client: fakeClient(receipts), usdg: USDG, recipient: TREASURY, minAmount: 1_000_000n } } : {}),
  })
const call = (app: ReturnType<typeof mk>, body: unknown) => app.inject({ method: 'POST', url: '/ask', payload: body as object })

async function seedToken(ageHours: number) {
  await db.insert(ponsTokens).values({
    address: getAddress(TOKEN), // indexer menyimpan alamat ber-checksum
    curve: '0x00000000000000000000000000000000000000ee',
    creator: PAYER,
    name: 'Test',
    symbol: 'TST',
    launchedAt: new Date(NOW.getTime() - ageHours * 3_600_000),
    creatorTaxBps: 1500,
    redFlags: ['High creator tax'],
    blockNumber: 1n,
  })
  const row = (i: number, side: 'buy' | 'sell') => ({
    id: `t${i}`,
    token: TOKEN,
    trader: PAYER,
    side,
    tokenAmount: '1',
    quoteAmount: '1',
    quoteDecimals: 18,
    at: NOW,
    blockNumber: 1n,
  })
  const [t] = await db.select().from(ponsTokens)
  await db.insert(ponsTrades).values([row(1, 'buy'), row(2, 'buy'), row(3, 'sell')].map((r) => ({ ...r, token: t!.address })))
}

describe.skipIf(!dbUp)('POST /ask (berbayar)', () => {
  beforeEach(async () => {
    await db.delete(askPayments)
    await db.delete(ponsTrades)
    await db.delete(ponsTokens)
  })
  afterAll(async () => {
    await client.end()
  })

  const body = (txHash: string, address = TOKEN) => ({ address, txHash })

  it('mati (503) selama fitur berbayar mati atau Ask belum dikonfigurasi', async () => {
    expect((await call(mk(false), body(h(10)))).statusCode).toBe(503)
    expect((await call(mk(true, false), body(h(10)))).statusCode).toBe(503)
  })

  it('400 untuk body tidak valid', async () => {
    expect((await call(mk(), { address: 'x', txHash: h(10) })).statusCode).toBe(400)
    expect((await call(mk(), { address: TOKEN })).statusCode).toBe(400)
  })

  it('402 bila pembayaran tidak sah: tx tak ada, gagal, kurang bayar, token lain, bukan ke penerima', async () => {
    await seedToken(5)
    const app = mk()
    const reason = async (tx: `0x${string}`) => {
      const r = await call(app, body(tx))
      expect(r.statusCode).toBe(402)
      return r.json().error
    }
    expect(await reason(h(99))).toBe('tx_not_found')
    expect(await reason(h(14))).toBe('tx_failed')
    expect(await reason(h(11))).toBe('underpaid')
    expect(await reason(h(12))).toBe('no_payment')
    expect(await reason(h(13))).toBe('no_payment')
  })

  it('200: laporan dari data indexer, pembayaran dicatat; pemakaian ulang = 409', async () => {
    await seedToken(5)
    const app = mk()
    const res = await call(app, body(h(10)))
    expect(res.statusCode).toBe(200)
    const out = askResponseSchema.parse(res.json())
    expect(out.report).toMatchObject({ symbol: 'TST', creatorTaxBps: 1500, redFlags: ['High creator tax'], trades: { total: 3, buys: 2, sells: 1 } })
    expect(out.report.unknowns).toContain('konsentrasi holder belum dianalisis')
    expect(out.report.ageSeconds).toBe(5 * 3600)
    expect(res.headers['cache-control']).toBe('private, no-store')
    const again = await call(app, body(h(10)))
    expect(again.statusCode).toBe(409)
  })

  it('token < 1 jam atau tanpa data: 422 dan pembayaran TIDAK dihabiskan', async () => {
    await seedToken(0.5)
    const app = mk()
    expect((await call(app, body(h(15)))).json()).toEqual({ error: 'token_too_new' })
    expect((await call(app, body(h(15), OTHER))).json()).toEqual({ error: 'no_data' })
    expect(await db.select().from(askPayments)).toHaveLength(0)
  })
})
