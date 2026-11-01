import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, postQueue, proAlerts, predictions, riskguardLog } from '@nexa-ai/db'
import {
  PUBLIC_POST_DELAY_MS,
  PipelineError,
  approvePost,
  dueForPublish,
  enqueuePost,
  getPost,
  listPending,
  rejectPost,
  type Db,
} from '../src/queue'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)

let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn(`Postgres test (${url}) tidak tersedia: test antrian dilewati`)
}

const NFA = 'Bukan nasihat keuangan.'
const T0 = new Date('2026-11-01T00:00:00Z')

async function insertPrediction(over: Partial<typeof predictions.$inferInsert> = {}) {
  const [row] = await db
    .insert(predictions)
    .values({ hash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`, preimageEncrypted: 'enc', ...over })
    .returning({ id: predictions.id })
  return row!.id
}

describe.skipIf(!dbUp)('antrian persetujuan', () => {
  beforeAll(() => undefined)
  beforeEach(async () => {
    await db.delete(proAlerts)
    await db.delete(postQueue)
    await db.delete(riskguardLog)
    await db.delete(predictions)
  })
  afterAll(async () => {
    await client.end()
  })

  const summary = (text: string) =>
    ({ kind: 'daily_summary', mode: 'dry', now: T0, input: { type: 'daily_summary', text, dataComplete: true } }) as const

  it('post aman masuk pending_approval (mode all) dan dijadwalkan +15 menit', async () => {
    const r = await enqueuePost(db, summary('Selisih DEX vs oracle NVDA 0.4%.'))
    expect(r.status).toBe('pending_approval')
    const post = await getPost(db, r.id)
    expect(post?.scheduledAt?.getTime()).toBe(T0.getTime() + PUBLIC_POST_DELAY_MS)
    expect(post?.mode).toBe('dry')
  })

  it('post yang diblokir RiskGuard langsung rejected dan tidak bisa disetujui', async () => {
    const r = await enqueuePost(db, summary('Sekarang waktunya beli NVDA'))
    expect(r.status).toBe('rejected')
    expect(r.decision.reasons).toContain('ADVICE_PHRASE')
    expect(await listPending(db)).toHaveLength(0)
    await expect(approvePost(db, r.id)).rejects.toThrow(PipelineError)
    expect((await getPost(db, r.id))?.status).toBe('rejected')
  })

  it('setiap keputusan dicatat di riskguard_log tanpa teks asli', async () => {
    await enqueuePost(db, summary('Sekarang waktunya beli NVDA'))
    await enqueuePost(db, summary('Selisih DEX vs oracle NVDA 0.4%.'))
    const logs = await db.select().from(riskguardLog)
    expect(logs).toHaveLength(2)
    expect(logs.map((l) => l.allowed).sort()).toEqual([false, true])
    expect(JSON.stringify(logs)).not.toContain('beli NVDA')
  })

  it('mode risky: ringkasan aman langsung approved', async () => {
    const r = await enqueuePost(db, { ...summary('Selisih DEX vs oracle NVDA 0.4%.'), riskguardConfig: { approvalMode: 'risky' } })
    expect(r.status).toBe('approved')
  })

  it('approve lalu dueForPublish hanya setelah jadwal lewat', async () => {
    const r = await enqueuePost(db, summary('Selisih DEX vs oracle NVDA 0.4%.'))
    await approvePost(db, r.id)
    expect(await dueForPublish(db, new Date(T0.getTime() + PUBLIC_POST_DELAY_MS - 1))).toHaveLength(0)
    expect(await dueForPublish(db, new Date(T0.getTime() + PUBLIC_POST_DELAY_MS))).toHaveLength(1)
  })

  it('reject menghapus dari daftar pending; tidak bisa approve dua kali', async () => {
    const r = await enqueuePost(db, summary('Selisih DEX vs oracle NVDA 0.4%.'))
    await rejectPost(db, r.id)
    expect(await listPending(db)).toHaveLength(0)
    await expect(approvePost(db, r.id)).rejects.toThrow(PipelineError)
  })

  describe('prediksi harus ter-commit sebelum masuk antrian', () => {
    const predInput = (text: string) => ({ type: 'prediction', text, dataComplete: true }) as const
    const text = `NVDA diprediksi ditutup lebih tinggi dalam 7 hari. ${NFA}`

    it('tanpa predictionId ditolak', async () => {
      await expect(enqueuePost(db, { kind: 'prediction', mode: 'dry', input: predInput(text) })).rejects.toThrow(PipelineError)
    })

    it('prediksi draft (belum commit) ditolak', async () => {
      const id = await insertPrediction({ status: 'draft' })
      await expect(enqueuePost(db, { kind: 'prediction', mode: 'dry', predictionId: id, input: predInput(text) })).rejects.toThrow(
        /belum ter-commit/,
      )
      expect(await db.select().from(postQueue)).toHaveLength(0)
    })

    it('status committed tanpa tx hash ditolak', async () => {
      const id = await insertPrediction({ status: 'committed', commitTxHash: null })
      await expect(enqueuePost(db, { kind: 'prediction', mode: 'dry', predictionId: id, input: predInput(text) })).rejects.toThrow(
        PipelineError,
      )
    })

    it('prediksi committed dengan tx hash diterima', async () => {
      const id = await insertPrediction({ status: 'committed', commitTxHash: `0x${'ab'.repeat(32)}` })
      const r = await enqueuePost(db, { kind: 'prediction', mode: 'dry', predictionId: id, input: predInput(text) })
      expect(r.status).toBe('pending_approval')
      expect((await getPost(db, r.id))?.predictionId).toBe(id)
    })

    it('angka yang tidak ada di fakta tool result ditolak; yang ada diterima', async () => {
      const id = await insertPrediction({ status: 'committed', commitTxHash: `0x${'ab'.repeat(32)}` })
      const bad = await enqueuePost(db, {
        kind: 'prediction',
        mode: 'dry',
        predictionId: id,
        input: { ...predInput('NVDA premium DEX 35 bps (+3,5%). Horizon 7 hari. ' + NFA), facts: ['35 bps', '0.35%', '7'] },
      })
      expect(bad.status).toBe('rejected')
      expect(bad.decision.reasons).toContain('NUMBER_UNTRACED')

      const good = await enqueuePost(db, {
        kind: 'prediction',
        mode: 'dry',
        predictionId: id,
        input: { ...predInput('NVDA premium DEX 35 bps (0.35%). Horizon 7 hari. ' + NFA), facts: ['35 bps', '0.35%', '7'] },
      })
      expect(good.status).toBe('pending_approval')
    })

    it('prediksi committed tapi teks melanggar RiskGuard tetap rejected', async () => {
      const id = await insertPrediction({ status: 'committed', commitTxHash: `0x${'ab'.repeat(32)}` })
      const r = await enqueuePost(db, { kind: 'prediction', mode: 'dry', predictionId: id, input: predInput('NVDA pasti naik') })
      expect(r.status).toBe('rejected')
    })
  })
})

// Memastikan tipe Db tetap kompatibel dengan createDb.
export type _Check = Db
