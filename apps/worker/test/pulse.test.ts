import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { costLog, createDb, ponsTokens, ponsTrades, postQueue, proAlerts, riskguardLog, whaleTransfers } from '@nexa-ai/db'
import { MockLlm } from '../src/llm'
import type { FeedHistory, OracleAsset } from '../src/oracle'
import { DEFAULT_PULSE_WINDOWS, newPulseState, runPulse, type PulseConfig, type PulseDeps } from '../src/pulse'
import type { ReportConfig } from '../src/reports'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test pulse dilewati')
}

// created_at memakai jam DB sungguhan, jadi waktu uji adalah waktu nyata.
const NOW = new Date()
const NOW_SEC = BigInt(Math.floor(NOW.getTime() / 1000))
const H = 3600n
const MIN = 60_000
const NVDA: OracleAsset = { symbol: 'NVDA', asset: '0x00000000000000000000000000000000000000a1', feed: '0x00000000000000000000000000000000000000f1' }
const TOKEN = '0x00000000000000000000000000000000000000c3'

function history(rounds: [bigint, bigint][]): FeedHistory {
  const info = (i: number) => ({ roundId: BigInt(i + 1), answer: rounds[i]![0], updatedAt: rounds[i]![1] })
  return {
    latest: async () => ({ ...info(rounds.length - 1), decimals: 8 }),
    round: async (_f, id) => (Number(id) >= 1 && Number(id) <= rounds.length ? info(Number(id) - 1) : null),
  }
}
const freshHistory = () => history([[20_000_000_000n, NOW_SEC - 25n * H], [20_070_000_000n, NOW_SEC - 60n]])

const reportCfg = (stockAssets: OracleAsset[]): ReportConfig => ({ summaryHourUtc: 0, ponsHourUtc: 0, stockAssets, maxAttemptsPerDay: 3, minRetryMs: 0 })
const pulseCfg: PulseConfig = { intervalMs: 30 * MIN, ...DEFAULT_PULSE_WINDOWS, minRetryMs: 0, maxFailuresPerTopic: 3, liveCap: 2 }

function make(llm: MockLlm, opts: { stock?: boolean; mode?: 'dry' | 'live'; cfg?: Partial<PulseConfig> } = {}): PulseDeps {
  return {
    report: { db, llm, mode: opts.mode ?? 'dry', history: freshHistory(), cfg: reportCfg(opts.stock ? [NVDA] : []), state: new Map() },
    cfg: { ...pulseCfg, ...opts.cfg },
    state: newPulseState(),
  }
}

const json = (text: string) => JSON.stringify({ text })
const ponsText = 'Most active Pons launch: DODO with 4 trades in the last 24 hours. Creator tax 15.00% (1500 bps), top holder 25.00% (2500 bps).'
const stockText = 'NVDA sits at $200.70, up 0.35% (35 bps) over the last 25 hours.'
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000)

async function clean() {
  await db.delete(proAlerts)
  await db.delete(postQueue)
  await db.delete(riskguardLog)
  await db.delete(costLog)
  await db.delete(ponsTrades)
  await db.delete(ponsTokens)
  await db.delete(whaleTransfers)
}

async function seedLaunch(address = TOKEN, symbol = 'DODO', ageHours = 5, over: Partial<typeof ponsTokens.$inferInsert> = {}) {
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
  await db.insert(ponsTrades).values(
    Array.from({ length: 4 }, (_, i) => ({
      id: `${address}-${i}`,
      token: address,
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

afterAll(async () => {
  if (dbUp) await clean()
  await client.end()
})

describe.skipIf(!dbUp)('pulse', () => {
  beforeEach(clean)

  it('launch paling ramai -> antrian jenis pulse; data nyata masuk prompt, alamat tidak', async () => {
    await seedLaunch()
    const llm = new MockLlm(() => json(ponsText))
    expect(await runPulse(make(llm), NOW)).toBe('queued')
    const [row] = await db.select().from(postQueue)
    expect(row).toMatchObject({ kind: 'pulse', status: 'pending_approval', mode: 'dry', content: ponsText })
    expect(llm.calls[0]!.user).toContain('"symbol":"DODO"')
    expect(llm.calls[0]!.user).not.toContain(TOKEN)
  })

  it('pulse yang belum terbit menahan pulse berikutnya (tidak menumpuk)', async () => {
    await seedLaunch()
    const d = make(new MockLlm(() => json(ponsText)), { stock: true })
    expect(await runPulse(d, NOW)).toBe('queued')
    expect(await runPulse(d, new Date(NOW.getTime() + 31 * MIN))).toBe('backlog')
    expect(await db.select().from(postQueue)).toHaveLength(1)
  })

  it('jarak minimum: pulse baru belum dibuat sebelum 30 menit, lalu memilih topik yang belum dibahas', async () => {
    await seedLaunch()
    const llm = new MockLlm((u) => json(u.user.includes('oraclePrice') ? stockText : ponsText))
    const d = make(llm, { stock: true })
    expect(await runPulse(d, NOW)).toBe('queued')
    await db.update(postQueue).set({ status: 'posted' })
    expect(await runPulse(d, new Date(NOW.getTime() + 10 * MIN))).toBe('wait')
    expect(await runPulse(d, new Date(NOW.getTime() + 31 * MIN))).toBe('queued')
    const rows = await db.select().from(postQueue).orderBy(postQueue.id)
    expect(rows).toHaveLength(2)
    expect(rows[1]!.content).toBe(stockText) // DODO sudah dibahas, jadi giliran Stock Token
  })

  it('tidak ada topik baru = tidak ada post (token yang sama tidak diulang)', async () => {
    await seedLaunch()
    const d = make(new MockLlm(() => json(ponsText)))
    expect(await runPulse(d, NOW)).toBe('queued')
    await db.update(postQueue).set({ status: 'posted' })
    expect(await runPulse(d, new Date(NOW.getTime() + 31 * MIN))).toBe('no_topic')
    expect(await db.select().from(postQueue)).toHaveLength(1)
  })

  it('tanpa data sama sekali = tidak ada post dan LLM tidak dipanggil', async () => {
    const llm = new MockLlm(() => json(ponsText))
    expect(await runPulse(make(llm), NOW)).toBe('no_topic')
    expect(llm.calls).toHaveLength(0)
  })

  it('token berumur < 1 jam tidak pernah dibahas', async () => {
    await seedLaunch(TOKEN, 'NEWB', 0.5)
    const llm = new MockLlm(() => json(ponsText))
    expect(await runPulse(make(llm), NOW)).toBe('no_topic')
    expect(llm.calls).toHaveLength(0)
  })

  it('teks yang tidak menyebut topiknya ditolak (topik tidak bisa dilacak), dan topik gagal dilewati setelah 3 kali', async () => {
    await seedLaunch()
    const llm = new MockLlm(() => json('Pons activity is high today with many trades in the last 24 hours.'))
    const d = make(llm)
    for (let i = 0; i < 3; i++) expect(await runPulse(d, NOW)).toBe('no_topic')
    expect(llm.calls).toHaveLength(3)
    expect(await runPulse(d, NOW)).toBe('no_topic')
    expect(llm.calls).toHaveLength(3) // percobaan ke-4 tidak memanggil LLM
    expect(await db.select().from(postQueue)).toHaveLength(0)
  })

  it('teks yang melanggar RiskGuard diblokir dan tidak masuk antrian terbit', async () => {
    await seedLaunch()
    const llm = new MockLlm(() => json('DODO is a strong buy, 4 trades in the last 24 hours.'))
    expect(await runPulse(make(llm), NOW)).toBe('blocked')
    const [row] = await db.select().from(postQueue)
    expect(row!.status).toBe('rejected')
  })

  it('mode live: berhenti membuat pulse setelah batas post live tercapai', async () => {
    await seedLaunch()
    const llm = new MockLlm(() => json(ponsText))
    const d = make(llm, { mode: 'live', cfg: { liveCap: 2 } })
    const posted = (n: number) =>
      db.insert(postQueue).values(Array.from({ length: n }, () => ({ kind: 'pulse', content: 'x', status: 'posted' as const, mode: 'live' as const, postedAt: new Date() })))
    await posted(1)
    expect(await runPulse(d, new Date(NOW.getTime() + 31 * MIN))).toBe('queued')
    await db.update(postQueue).set({ status: 'posted' }).where(eq(postQueue.status, 'pending_approval'))
    expect(await runPulse(d, new Date(NOW.getTime() + 62 * MIN))).toBe('cap_reached')
    expect(llm.calls).toHaveLength(1)
  })

  it('mode dry tidak terpengaruh batas post live', async () => {
    await seedLaunch()
    const d = make(new MockLlm(() => json(ponsText)), { mode: 'dry', cfg: { liveCap: 0 } })
    expect(await runPulse(d, NOW)).toBe('queued')
  })

  it('post yang ditolak manusia tidak menahan pulse berikutnya', async () => {
    await seedLaunch()
    const d = make(new MockLlm(() => json(ponsText)))
    expect(await runPulse(d, NOW)).toBe('queued')
    await db.update(postQueue).set({ status: 'rejected' })
    expect(await runPulse(d, NOW)).toBe('queued')
  })
})
