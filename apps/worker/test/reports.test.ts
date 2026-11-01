import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { costLog, createDb, ponsTokens, ponsTrades, postQueue, proAlerts, riskguardLog, whaleTransfers } from '@nexa-ai/db'
import { MockLlm } from '../src/llm'
import type { FeedHistory, OracleAsset } from '../src/oracle'
import { runDailyReports, type ReportConfig, type ReportDeps } from '../src/reports'
import { safeSymbol } from '../src/facts'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test laporan harian dilewati')
}

// Hari ini (UTC) 10:00: kolom created_at memakai jam DB sungguhan, jadi tanggal uji harus hari ini.
const NOW = new Date(new Date().toISOString().slice(0, 10) + 'T10:00:00.000Z')
const NOW_SEC = BigInt(Math.floor(NOW.getTime() / 1000))
const H = 3600n
const NVDA: OracleAsset = { symbol: 'NVDA', asset: '0x00000000000000000000000000000000000000a1', feed: '0x00000000000000000000000000000000000000f1' }

/** Riwayat palsu: round [answer, updatedAt]; id naik. */
function history(rounds: [bigint, bigint][]): FeedHistory {
  const info = (i: number) => ({ roundId: BigInt(i + 1), answer: rounds[i]![0], updatedAt: rounds[i]![1] })
  return {
    latest: async () => ({ ...info(rounds.length - 1), decimals: 8 }),
    round: async (_f, id) => (Number(id) >= 1 && Number(id) <= rounds.length ? info(Number(id) - 1) : null),
  }
}
// 200.00 (25 jam lalu) -> 200.70 sekarang: +35 bps, jendela 25 jam
const freshHistory = () => history([[20_000_000_000n, NOW_SEC - 25n * H], [20_070_000_000n, NOW_SEC - 60n]])

const cfg: ReportConfig = { summaryHourUtc: 9, ponsHourUtc: 9, stockAssets: [NVDA], maxAttemptsPerDay: 3, minRetryMs: 15 * 60_000 }
const make = (llm: MockLlm, h: FeedHistory = freshHistory(), c: Partial<ReportConfig> = {}): ReportDeps => ({
  db,
  llm,
  mode: 'dry',
  history: h,
  cfg: { ...cfg, ...c },
  state: new Map(),
})

const goodSummary = 'NVDA sits at $200.70, up 0.35% (35 bps) over the last 25 hours. 2 large transfers moved 4200 tokens.'
const json = (text: string) => JSON.stringify({ text })
const MIN = 60_000

async function clean() {
  await db.delete(proAlerts)
  await db.delete(postQueue)
  await db.delete(riskguardLog)
  await db.delete(costLog)
  await db.delete(ponsTrades)
  await db.delete(ponsTokens)
  await db.delete(whaleTransfers)
}

afterAll(async () => {
  if (dbUp) await clean()
  await client.end()
})

async function seedWhales() {
  const base = { token: NVDA.asset, from: '0x01', to: '0x02', amount: '2100000000000000000000', decimals: 18, blockNumber: 1n }
  await db.insert(whaleTransfers).values([
    { ...base, id: 'w1', at: new Date(NOW.getTime() - 3_600_000) },
    { ...base, id: 'w2', at: new Date(NOW.getTime() - 7_200_000) },
    { ...base, id: 'w3', at: new Date(NOW.getTime() - 30 * 3_600_000) }, // di luar 24 jam
  ])
}

describe('safeSymbol', () => {
  it('hanya simbol alfanumerik pendek; iklan, spasi, dan simbol aneh dibuang', () => {
    expect(safeSymbol('DODO')).toBe('DODO')
    expect(safeSymbol('Buy now http://x.io')).toBeNull()
    expect(safeSymbol('A')).toBeNull()
    expect(safeSymbol('$PEPE')).toBeNull()
    expect(safeSymbol('ABCDEFGHIJK')).toBeNull()
    expect(safeSymbol(null)).toBeNull()
  })
})

describe.skipIf(!dbUp)('ringkasan harian Stock Token', () => {
  beforeEach(clean)

  it('data oracle + perubahan + whale -> antrian persetujuan, dengan fakta terlacak', async () => {
    await seedWhales()
    const llm = new MockLlm(() => json(goodSummary))
    const r = await runDailyReports(make(llm), NOW)
    expect(r.summary).toBe('queued')
    const [row] = await db.select().from(postQueue)
    expect(row).toMatchObject({ kind: 'daily_summary', status: 'pending_approval', mode: 'dry', content: goodSummary })
    // prompt memuat data nyata dan melarang pembahasan DEX (tidak ada sumber harga DEX)
    const prompt = llm.calls[0]!.user
    expect(prompt).toContain('$200.70')
    expect(prompt).toContain('35 bps')
    expect(prompt).toContain('4200')
    expect(prompt).toContain('do not discuss DEX prices')
    expect(llm.calls[0]!.tier).toBe('small')
  })

  it('idempoten: setelah masuk antrian hari ini, tidak memanggil LLM lagi', async () => {
    await seedWhales()
    const llm = new MockLlm(() => json(goodSummary))
    const d = make(llm)
    await runDailyReports(d, NOW)
    const again = await runDailyReports(d, NOW)
    expect(again.summary).toBe('done')
    expect(llm.calls).toHaveLength(1)
  })

  it('belum jam-nya: tidak berbuat apa pun', async () => {
    const llm = new MockLlm(() => json(goodSummary))
    const r = await runDailyReports(make(llm, freshHistory(), { summaryHourUtc: 12, ponsHourUtc: 12 }), NOW)
    expect(r).toEqual({ summary: 'not_yet', pons: 'not_yet' })
    expect(llm.calls).toHaveLength(0)
  })

  it('angka yang tidak ada di data diblokir RiskGuard (NUMBER_UNTRACED); percobaan dibatasi per hari', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70 and moved 5% over the last 25 hours.'))
    const d = make(llm)
    expect((await runDailyReports(d, NOW)).summary).toBe('blocked')
    expect((await db.select().from(postQueue))[0]!.status).toBe('rejected')
    expect((await runDailyReports(d, new Date(NOW.getTime() + 5 * MIN))).summary).toBe('retry_later') // terlalu cepat
    expect(llm.calls).toHaveLength(1)
    expect((await runDailyReports(d, new Date(NOW.getTime() + 20 * MIN))).summary).toBe('blocked')
    expect((await runDailyReports(d, new Date(NOW.getTime() + 40 * MIN))).summary).toBe('blocked')
    expect((await runDailyReports(d, new Date(NOW.getTime() + 60 * MIN))).summary).toBe('limit') // 3 percobaan
    expect(llm.calls).toHaveLength(3)
  })

  it('ajakan beli dan target harga diblokir', async () => {
    const buy = await runDailyReports(make(new MockLlm(() => json('Buy NVDA at $200.70 now.'))), NOW)
    expect(buy.summary).toBe('blocked')
  })

  it('feed basi, harga nol, atau gagal dibaca: tidak ada post dan LLM tidak dipanggil (tidak tahu)', async () => {
    const llm = new MockLlm(() => json(goodSummary))
    const stale = history([[20_000_000_000n, NOW_SEC - 10n * 24n * H], [20_070_000_000n, NOW_SEC - 5n * 24n * H]])
    expect((await runDailyReports(make(llm, stale), NOW)).summary).toBe('no_data')
    const broken: FeedHistory = { latest: async () => { throw new Error('rpc') }, round: async () => null }
    expect((await runDailyReports(make(llm, broken), NOW)).summary).toBe('no_data')
    expect(llm.calls).toHaveLength(0)
    expect(await db.select().from(postQueue)).toHaveLength(0)
  })

  it('riwayat tidak cukup: tetap dibuat tanpa angka perubahan (tidak menebak)', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70. The daily change is not known yet.'))
    const one = history([[20_070_000_000n, NOW_SEC - 60n]])
    expect((await runDailyReports(make(llm, one), NOW)).summary).toBe('queued')
    expect(llm.calls[0]!.user).toContain('"change":null')
  })

  it('LLM gagal: ditangkap per laporan, tidak melempar ke siklus worker', async () => {
    const llm = new MockLlm(() => 'bukan json')
    const r = await runDailyReports(make(llm), NOW)
    expect(r.summary).toBe('error')
  })
})

describe.skipIf(!dbUp)('laporan Pons V2', () => {
  beforeEach(clean)
  const T = '0x00000000000000000000000000000000000000c3'
  const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000)

  async function launch(address: string, symbol: string, ageHours: number, over: Partial<typeof ponsTokens.$inferInsert> = {}) {
    await db.insert(ponsTokens).values({
      address,
      curve: '0x00000000000000000000000000000000000000ee',
      creator: '0x00000000000000000000000000000000000000d1',
      name: symbol,
      symbol,
      launchedAt: hoursAgo(ageHours),
      creatorTaxBps: 1500,
      topHolderShareBps: 2500,
      redFlags: ['High creator tax', 'Holders concentrated'],
      blockNumber: 1n,
      ...over,
    })
  }
  async function trades(token: string, n: number) {
    await db.insert(ponsTrades).values(
      Array.from({ length: n }, (_, i) => ({
        id: `${token}-${i}`,
        token,
        trader: '0x00000000000000000000000000000000000000d2',
        side: (i % 2 ? 'sell' : 'buy') as 'buy' | 'sell',
        tokenAmount: '1',
        quoteAmount: '1',
        quoteDecimals: 18,
        at: hoursAgo(1),
        blockNumber: 2n,
      })),
    )
  }
  const text = 'Most active Pons launch: DODO with 4 trades in the last 24 hours. Creator tax 15.00% (1500 bps), top holder 25.00% (2500 bps).'

  it('launch paling ramai + red flag -> antrian; token dibatasi umur >= 1 jam', async () => {
    await launch(T, 'DODO', 5)
    await trades(T, 4)
    const llm = new MockLlm(() => json(text))
    const r = await runDailyReports(make(llm, history([])), NOW)
    expect(r.pons).toBe('queued')
    const [row] = await db.select().from(postQueue)
    expect(row).toMatchObject({ kind: 'pons_report', status: 'pending_approval' })
    const prompt = llm.calls[0]!.user
    expect(prompt).toContain('"symbol":"DODO"')
    expect(prompt).toContain('"tradesLast24h":4')
    expect(prompt).toContain('High creator tax')
    expect(prompt).not.toContain(T) // alamat tidak dikirim ke LLM
  })

  it('token berumur < 1 jam tidak pernah dibahas; tanpa kandidat = tidak ada post', async () => {
    await launch(T, 'NEWB', 0.5)
    await trades(T, 9)
    const llm = new MockLlm(() => json(text))
    expect((await runDailyReports(make(llm, history([])), NOW)).pons).toBe('no_data')
    expect(llm.calls).toHaveLength(0)
  })

  it('token lama yang kebetulan ramai bukan "launch": diabaikan', async () => {
    await launch(T, 'OLDY', 48)
    await trades(T, 9)
    expect((await runDailyReports(make(new MockLlm(() => json(text)), history([])), NOW)).pons).toBe('no_data')
  })

  it('graduation dalam 24 jam dilaporkan walau tanpa launch baru', async () => {
    await launch(T, 'GRAD', 72, { graduatedAt: hoursAgo(2) })
    const ok = new MockLlm(() => json('1 Pons token graduated today: GRAD.'))
    const r = await runDailyReports(make(ok, history([])), NOW)
    expect(r.pons).toBe('queued')
    expect(ok.calls[0]!.user).toContain('"graduationsLast24h":{"count":1,"symbols":["GRAD"]}')
    expect((await runDailyReports(make(ok, history([])), NOW)).pons).toBe('done') // sudah ada hari ini
  })

  it('nama token berbahaya: simbol disanitasi sebelum ke LLM; "BUY" yang lolos disaring tetap diblokir RiskGuard', async () => {
    await launch(T, 'Beli http://x.io sekarang', 5)
    await trades(T, 4)
    const llm = new MockLlm(() => json('The most active launch logged 4 trades. Creator tax 15.00% (1500 bps).'))
    await runDailyReports(make(llm, history([])), NOW)
    expect(llm.calls[0]!.user).not.toContain('http')
    expect(llm.calls[0]!.user).toContain('token without a safe symbol to display')

    await clean()
    await launch(T, 'BUY', 5)
    await trades(T, 4)
    const echo = new MockLlm(() => json('BUY is the most active launch with 4 trades.'))
    expect((await runDailyReports(make(echo, history([])), NOW)).pons).toBe('blocked')
  })
})

describe.skipIf(!dbUp)('ringkasan harian: selisih DEX vs oracle', () => {
  beforeEach(clean)
  // oracle $200.70 (+35 bps / 25 jam); kuotasi DEX palsu
  const quote = (priceE8: bigint): ReportDeps['dex'] => async () => ({ priceE8, poolId: `0x${'ab'.repeat(32)}`, depthUsdg: '4220289', poolsChecked: 43 })
  const withDex = (llm: MockLlm, dex: ReportDeps['dex']): ReportDeps => ({ ...make(llm), dex })

  it('DEX di atas oracle: selisih masuk prompt, fakta terlacak, post masuk antrian', async () => {
    const text = 'NVDA sits at $200.70, up 0.35% (35 bps) over the last 25 hours. The DEX price of $205.02 sits 2.15% above the oracle (215 bps).'
    const llm = new MockLlm(() => json(text))
    const r = await runDailyReports(withDex(llm, quote(20_502_000_000n)), NOW)
    expect(r.summary).toBe('queued')
    const prompt = llm.calls[0]!.user
    expect(prompt).toContain('"dex":{"price":"$205.02"')
    expect(prompt).toContain('"direction":"above"')
    expect(prompt).toContain('215 bps')
    expect(prompt).toContain('is present')
    expect((await db.select().from(postQueue))[0]).toMatchObject({ status: 'pending_approval', content: text })
  })

  it('DEX di bawah oracle: arah "below", bps dibulatkan ke nol', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70. The DEX price of $199.00 sits 0.84% below the oracle (84 bps).'))
    const r = await runDailyReports(withDex(llm, quote(19_900_000_000n)), NOW)
    expect(r.summary).toBe('queued')
    expect(llm.calls[0]!.user).toContain('"direction":"below"')
    expect(llm.calls[0]!.user).toContain('"bps":"84 bps"')
  })

  it('angka DEX yang tidak ada di data tetap diblokir (NUMBER_UNTRACED)', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70. The DEX price of $205.02 sits 3% above the oracle.'))
    expect((await runDailyReports(withDex(llm, quote(20_502_000_000n)), NOW)).summary).toBe('blocked')
  })

  it('selisih tidak wajar (> 20%) dibuang: ringkasan tidak membahas DEX', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70, up 0.35% (35 bps) over the last 25 hours.'))
    const r = await runDailyReports(withDex(llm, quote(10_000_000_000n)), NOW) // $100 vs $200,70 = -50%
    expect(r.summary).toBe('queued')
    expect(llm.calls[0]!.user).toContain('"dex":null')
    expect(llm.calls[0]!.user).toContain('DEX prices are not available')
  })

  it('DEX gagal atau tanpa pool yang cukup dalam: ringkasan tetap dibuat tanpa DEX', async () => {
    const llm = new MockLlm(() => json('NVDA sits at $200.70, up 0.35% (35 bps) over the last 25 hours.'))
    const boom = await runDailyReports(withDex(llm, async () => { throw new Error('rpc') }), NOW)
    expect(boom.summary).toBe('queued')
    await clean()
    const none = await runDailyReports(withDex(llm, async () => null), NOW)
    expect(none.summary).toBe('queued')
    expect(llm.calls.every((c) => c.user.includes('"dex":null'))).toBe(true)
  })
})
