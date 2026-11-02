import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { costLog, createDb, postQueue, proAlerts } from '@nexa-ai/db'
import { eq } from 'drizzle-orm'
import { publishDue, type CycleDeps } from '../src/cycle'
import { XApiError, type XClient } from '../src/x'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test penerbit dilewati')
}

const T0 = new Date('2026-11-02T12:00:00Z')
const MIN = 60_000

const fakeX = (impl?: (text: string) => Promise<{ id: string }>) => {
  const sent: string[] = []
  const x: XClient = {
    post: async (text) => {
      sent.push(text)
      return impl ? impl(text) : { id: String(1000 + sent.length) }
    },
  }
  return { x, sent }
}

const deps = (publish?: CycleDeps['publish']) => ({ db, mode: 'live', ...(publish ? { publish } : {}) }) as unknown as CycleDeps

async function seed(kind: string, content: string, mode: 'dry' | 'live' = 'live') {
  const [row] = await db
    .insert(postQueue)
    .values({ kind, content, status: 'approved', mode, scheduledAt: new Date(T0.getTime() - 1) })
    .returning({ id: postQueue.id })
  return row!.id
}
const statusOf = async (id: number) => (await db.select().from(postQueue).where(eq(postQueue.id, id)))[0]!

describe.skipIf(!dbUp)('penerbit X (mode live)', () => {
  beforeEach(async () => {
    await db.delete(proAlerts)
    await db.delete(postQueue)
    await db.delete(costLog)
  })
  afterAll(async () => {
    await db.delete(proAlerts)
    await db.delete(postQueue)
    await db.delete(costLog)
    await client.end()
  })

  it('tanpa kebijakan penerbitan (tanpa kredensial X) post live menunggu dan siklus tidak gagal', async () => {
    const id = await seed('daily_summary', 'a')
    expect(await publishDue(deps(), T0)).toEqual([])
    expect((await statusOf(id)).status).toBe('approved')
  })

  it('batas jumlah post: berhenti setelah batas tercapai, sisanya tetap menunggu', async () => {
    const { x, sent } = fakeX()
    const [a, b, c] = [await seed('daily_summary', 'satu'), await seed('daily_summary', 'dua'), await seed('daily_summary', 'tiga')]
    const published = await publishDue(deps({ x, liveCap: 2, minGapMs: 0 }), T0)
    expect(published).toEqual([a, b])
    expect(sent).toEqual(['satu', 'dua'])
    expect((await statusOf(c)).status).toBe('approved')
    // batas sudah penuh: siklus berikutnya tidak mengirim apa pun
    expect(await publishDue(deps({ x, liveCap: 2, minGapMs: 0 }), new Date(T0.getTime() + 60 * MIN))).toEqual([])
    expect(sent).toHaveLength(2)
    // batas dinaikkan: post yang menunggu terbit
    expect(await publishDue(deps({ x, liveCap: 3, minGapMs: 0 }), new Date(T0.getTime() + 60 * MIN))).toEqual([c])
  })

  it('liveCap 0 = tidak ada post live', async () => {
    const { x, sent } = fakeX()
    const id = await seed('daily_summary', 'a')
    expect(await publishDue(deps({ x, liveCap: 0, minGapMs: 0 }), T0)).toEqual([])
    expect(sent).toEqual([])
    expect((await statusOf(id)).status).toBe('approved')
  })

  it('jeda minimum 30 menit: satu post per jeda', async () => {
    const { x, sent } = fakeX()
    const policy = { x, liveCap: 10, minGapMs: 30 * MIN }
    const [a, b] = [await seed('daily_summary', 'satu'), await seed('daily_summary', 'dua')]
    expect(await publishDue(deps(policy), T0)).toEqual([a])
    expect(await publishDue(deps(policy), new Date(T0.getTime() + 29 * MIN))).toEqual([])
    expect(await publishDue(deps(policy), new Date(T0.getTime() + 30 * MIN))).toEqual([b])
    expect(sent).toEqual(['satu', 'dua'])
  })

  it('hanya jenis post yang diizinkan yang keluar; yang lain tetap menunggu', async () => {
    const { x, sent } = fakeX()
    const pred = await seed('prediction', 'prediksi')
    const sum = await seed('daily_summary', 'ringkasan')
    expect(await publishDue(deps({ x, liveCap: 10, minGapMs: 0, kinds: ['daily_summary', 'pons_report'] }), T0)).toEqual([sum])
    expect(sent).toEqual(['ringkasan'])
    expect((await statusOf(pred)).status).toBe('approved')
  })

  it('id post X disimpan, biaya dicatat, dan post tidak terkirim dua kali', async () => {
    const { x, sent } = fakeX(async () => ({ id: '777' }))
    const id = await seed('daily_summary', 'a')
    await publishDue(deps({ x, liveCap: 10, minGapMs: 0 }), T0)
    await publishDue(deps({ x, liveCap: 10, minGapMs: 0 }), new Date(T0.getTime() + MIN))
    const row = await statusOf(id)
    expect(row.status).toBe('posted')
    expect(row.externalId).toBe('777')
    expect(sent).toHaveLength(1)
    const costs = await db.select().from(costLog)
    expect(costs.map((c) => [c.category, c.ref, c.usdMicros])).toEqual([['x_api', 'post', 15_000n]])
  })

  it('galat sementara: post kembali ke antrian dan dicoba lagi; tidak dihitung ke batas', async () => {
    let fail = true
    const { x } = fakeX(async () => {
      if (fail) throw new XApiError('X menjawab 503', 503, true)
      return { id: '5' }
    })
    const id = await seed('daily_summary', 'a')
    expect(await publishDue(deps({ x, liveCap: 1, minGapMs: 0 }), T0)).toEqual([])
    const row = await statusOf(id)
    expect([row.status, row.postedAt, row.externalId]).toEqual(['approved', null, null])
    fail = false
    expect(await publishDue(deps({ x, liveCap: 1, minGapMs: 0 }), new Date(T0.getTime() + MIN))).toEqual([id])
  })

  it('galat permanen (mis. duplikat): post ditolak dan tidak diulang terus', async () => {
    const { x, sent } = fakeX(async () => {
      throw new XApiError('X menolak post (403): duplicate content', 403, false)
    })
    const id = await seed('daily_summary', 'a')
    expect(await publishDue(deps({ x, liveCap: 10, minGapMs: 0 }), T0)).toEqual([])
    expect((await statusOf(id)).status).toBe('rejected')
    expect(await publishDue(deps({ x, liveCap: 10, minGapMs: 0 }), new Date(T0.getTime() + MIN))).toEqual([])
    expect(sent).toHaveLength(1)
  })

  it('post dry tidak pernah menyentuh X', async () => {
    const { x, sent } = fakeX()
    const id = await seed('daily_summary', 'a', 'dry')
    expect(await publishDue(deps({ x, liveCap: 0, minGapMs: 0 }), T0)).toEqual([id])
    expect(sent).toEqual([])
    expect((await statusOf(id)).externalId).toBe(`dry-${id}`)
  })
})
