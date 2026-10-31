import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { zeroAddress, type Address, type Hex } from 'viem'
import { costLog, createDb, postQueue, predictions, riskguardLog } from '@nexa-ai/db'
import { newDailyState, runDailyPrediction, type DailyConfig, type DailyDeps } from '../src/daily'
import type { LedgerClient } from '../src/ledger'
import { MockLlm } from '../src/llm'
import type { FeedReader } from '../src/oracle'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test prediksi harian dilewati')
}

const NFA = 'Bukan nasihat keuangan.'
const ASSET = '0x00000000000000000000000000000000000000a1' as Address
const FEED = '0x00000000000000000000000000000000000000f1' as Address
// Hari ini (UTC) pukul 10:00: kolom created_at memakai jam DB sungguhan, jadi tanggal uji harus hari ini.
const NOW = new Date(new Date().toISOString().slice(0, 10) + 'T10:00:00.000Z')
const NOW_SEC = BigInt(Math.floor(NOW.getTime() / 1000))
const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex

let commits = 0
const ledger = {
  chainTime: async () => NOW_SEC,
  feedOf: async (a: Address) => (a === ASSET ? FEED : zeroAddress),
  commit: async () => {
    commits++
    return { ledgerId: commits, txHash: h(commits), committedAt: NOW_SEC }
  },
} as unknown as LedgerClient

const freshFeed: FeedReader = async () => ({ answer: 20_528_000_142n, decimals: 8, updatedAt: NOW_SEC - 60n })
const good = JSON.stringify({ symbol: 'NVDA', direction: 'up', text: `NVDA diprediksi ditutup lebih tinggi dalam 7 hari. ${NFA}` })
const bad = JSON.stringify({ symbol: 'NVDA', direction: 'up', text: `Beli NVDA sekarang, pasti naik. ${NFA}` })

const cfg: DailyConfig = { hourUtc: 9, assets: [{ symbol: 'NVDA', asset: ASSET }], maxAttemptsPerDay: 3, minRetryMs: 15 * 60 * 1000 }
const make = (llm: MockLlm, read: FeedReader = freshFeed, c: Partial<DailyConfig> = {}): DailyDeps => ({
  cycle: { db, ledger, encKey: '11'.repeat(32), mode: 'dry' },
  llm,
  read,
  cfg: { ...cfg, ...c },
  state: newDailyState(),
})

describe.skipIf(!dbUp)('prediksi harian', () => {
  beforeEach(async () => {
    commits = 0
    await db.delete(postQueue)
    await db.delete(riskguardLog)
    await db.delete(predictions)
    await db.delete(costLog)
  })
  afterAll(async () => {
    await client.end()
  })

  it('sebelum jam mulai: tidak melakukan apa pun', async () => {
    const llm = new MockLlm(() => good)
    expect(await runDailyPrediction(make(llm), new Date(NOW.getTime() - 61 * 60_000))).toBe('not_yet')
    expect(llm.calls).toHaveLength(0)
  })

  it('siklus penuh: LLM -> RiskGuard -> commit -> antrian persetujuan; tepat satu per hari', async () => {
    const llm = new MockLlm(() => good)
    const d = make(llm)
    expect(await runDailyPrediction(d, NOW)).toBe('queued')
    const [p] = await db.select().from(predictions)
    expect(p).toMatchObject({ status: 'committed', ledgerId: 1, commitTxHash: h(1) })
    const [q] = await db.select().from(postQueue)
    expect(q).toMatchObject({ kind: 'prediction', predictionId: p!.id, mode: 'dry' })
    expect(q!.status).toBe('pending_approval') // human-in-the-loop 30 hari pertama
    // siklus berikutnya di hari yang sama: tidak ada prediksi kedua dan LLM tidak dipanggil lagi
    const callsBefore = llm.calls.length
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 3_600_000))).toBe('idle')
    expect(llm.calls).toHaveLength(callsBefore)
    expect(commits).toBe(1)
    expect(await db.select().from(predictions)).toHaveLength(1)
  })

  it('draft ditolak RiskGuard: TIDAK di-commit on-chain dan tidak ada draft; keputusan dicatat', async () => {
    const llm = new MockLlm(() => bad)
    expect(await runDailyPrediction(make(llm), NOW)).toBe('blocked')
    expect(commits).toBe(0)
    expect(await db.select().from(predictions)).toHaveLength(0)
    expect((await db.select().from(riskguardLog))[0]!.allowed).toBe(false)
  })

  it('tanpa data oracle (feed basi atau belum terdaftar): tidak ada prediksi dan LLM tidak dipanggil', async () => {
    const llm = new MockLlm(() => good)
    const stale: FeedReader = async () => ({ answer: 1n, decimals: 8, updatedAt: NOW_SEC - 10n * 86_400n })
    expect(await runDailyPrediction(make(llm, stale), NOW)).toBe('no_data')
    expect(await runDailyPrediction(make(llm, freshFeed, { assets: [{ symbol: 'X', asset: '0x00000000000000000000000000000000000000b2' }] }), NOW)).toBe('no_data')
    expect(llm.calls).toHaveLength(0)
    expect(commits).toBe(0)
  })

  it('percobaan gagal dibatasi: jeda minimum, lalu batas harian', async () => {
    const llm = new MockLlm(() => bad)
    const d = make(llm)
    expect(await runDailyPrediction(d, NOW)).toBe('blocked')
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 60_000))).toBe('retry_later')
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 16 * 60_000))).toBe('blocked')
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 32 * 60_000))).toBe('blocked')
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 48 * 60_000))).toBe('limit')
    // hari berikutnya hitungan di-reset
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 86_400_000))).toBe('blocked')
  })

  it('melanjutkan draft yang commit-nya gagal (proses mati di tengah) tanpa membuat prediksi baru', async () => {
    const llm = new MockLlm(() => good)
    const flaky = { ...ledger, commit: async () => { throw new Error('rpc mati') } } as unknown as LedgerClient
    const d = make(llm)
    d.cycle = { ...d.cycle, ledger: flaky }
    await expect(runDailyPrediction(d, NOW)).rejects.toThrow('rpc mati')
    expect((await db.select().from(predictions))[0]!.status).toBe('draft')
    d.cycle = { ...d.cycle, ledger }
    expect(await runDailyPrediction(d, new Date(NOW.getTime() + 60_000))).toBe('queued')
    expect(await db.select().from(predictions)).toHaveLength(1)
    expect((await db.select().from(predictions))[0]!.status).toBe('committed')
    expect(llm.calls).toHaveLength(1)
  })
})
