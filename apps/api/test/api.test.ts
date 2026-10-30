import { readFileSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, ponsTokens, predictions } from '@nexa-ai/db'
import {
  burnResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
} from '@nexa-ai/api-client'
import { buildApp } from '../src/app'
import { buildOpenApi } from '../src/openapi'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test API dilewati')
}

const EXPLORER = 'https://explorer.example.test'
const NOW = new Date('2026-12-01T12:00:00.000Z')
const NVDA = '0x00000000000000000000000000000000000ae1da'
const SECRET_TEXT = 'TEKS-RAHASIA-SEBELUM-REVEAL'
const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
const day = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

let seq = 0
async function seed(over: Partial<typeof predictions.$inferInsert> & { ledgerId: number | null }) {
  seq++
  const committedAt = over.committedAt ?? day(1)
  await db.insert(predictions).values({
    hash: h(1000 + seq),
    preimageEncrypted: 'enc',
    status: 'committed',
    commitTxHash: h(2000 + seq),
    committedAt,
    maturesAt: new Date(committedAt.getTime() + 7 * 86_400_000),
    ...over,
  })
}

const app = buildApp({ db, explorerUrl: EXPLORER, webOrigin: 'https://web.example.test', symbols: { [NVDA]: 'NVDA' }, now: () => NOW })

const revealed = (ledgerId: number, direction: 1 | 2, returnBps: number, won: boolean, daysAgo: number) =>
  seed({
    ledgerId,
    status: 'revealed',
    committedAt: day(daysAgo),
    revealedText: `Prediksi ${ledgerId}. Bukan nasihat keuangan.`,
    revealedAsset: NVDA,
    revealedDirection: direction,
    revealTxHash: h(3000 + ledgerId),
    won,
    returnBps,
  })

describe.skipIf(!dbUp)('API publik', () => {
  beforeEach(async () => {
    seq = 0
    await db.delete(predictions)
    await db.delete(ponsTokens)
  })
  afterAll(async () => {
    await app.close()
    await client.end()
  })

  const get = async (path: string, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url: path, headers })

  describe('GET /proof', () => {
    it('kosong: win rate null (sebelum panggilan pertama dinilai)', async () => {
      const res = await get('/proof')
      expect(res.statusCode).toBe(200)
      const body = proofResponseSchema.parse(res.json())
      expect(body.stats).toEqual({ scored: 0, wins: 0, pending: 0, winRate: null, avgReturnBps: null })
      expect(body.current).toBeNull()
      expect(body.formatted).toEqual({ winRate: null, avgReturn: null })
    })

    it('menghitung win rate dan rata-rata return searah klaim', async () => {
      await revealed(0, 1, 400, true, 20) // naik, +4%  -> +400
      await revealed(1, 2, -300, true, 15) // turun, harga -3% -> menang, +300 searah klaim
      await revealed(2, 1, -250, false, 10) // naik, harga -2.5% -> kalah, -250
      const body = proofResponseSchema.parse((await get('/proof')).json())
      expect(body.stats.scored).toBe(3)
      expect(body.stats.wins).toBe(2)
      expect(body.stats.winRate).toBeCloseTo(2 / 3)
      expect(body.stats.avgReturnBps).toBe(150) // (400 + 300 - 250) / 3
      expect(body.formatted).toEqual({ winRate: '66.7%', avgReturn: '+1.50%' })
      const down = body.recent.find((p) => p.id === 1)!
      expect(down.revealed).toMatchObject({ direction: 'down', returnBps: 300, returnFormatted: '+3.00%', assetSymbol: 'NVDA' })
    })

    it('hari ke-N Prediction of the Day dan link Blockscout', async () => {
      await seed({ ledgerId: 5, status: 'posted', committedAt: day(3.5) })
      const body = proofResponseSchema.parse((await get('/proof')).json())
      expect(body.current?.day).toBe(4)
      expect(body.stats.pending).toBe(1)
      expect(body.current?.prediction.commitTxUrl).toBe(`${EXPLORER}/tx/${body.current?.prediction.commitTxHash}`)
    })

    it('hari dibatasi pada horizon', async () => {
      await seed({ ledgerId: 5, status: 'posted', committedAt: day(30) })
      expect((proofResponseSchema.parse((await get('/proof')).json())).current?.day).toBe(7)
    })

    it('draft tidak pernah terlihat, dan teks sebelum reveal tidak bocor', async () => {
      await seed({ ledgerId: null, status: 'draft', commitTxHash: null, committedAt: null, maturesAt: null })
      await seed({ ledgerId: 9, status: 'committed', revealedText: SECRET_TEXT, revealedAsset: NVDA, revealedDirection: 1 })
      const res = await get('/proof')
      const body = proofResponseSchema.parse(res.json())
      expect(body.recent).toHaveLength(1)
      expect(body.recent[0]?.id).toBe(9)
      expect(body.recent[0]?.revealed).toBeNull()
      expect(res.body).not.toContain(SECRET_TEXT)
    })

    it('CORS mengizinkan WEB_ORIGIN', async () => {
      const res = await get('/proof', { origin: 'https://web.example.test' })
      expect(res.headers['access-control-allow-origin']).toBe('https://web.example.test')
    })
  })

  describe('GET /predictions/:id', () => {
    it('mengembalikan prediksi menurut id NexaLedger', async () => {
      await revealed(7, 1, 380, true, 9)
      const res = await get('/predictions/7')
      expect(res.statusCode).toBe(200)
      const p = predictionResponseSchema.parse(res.json())
      expect(p.id).toBe(7)
      expect(p.revealed?.revealTxUrl).toBe(`${EXPLORER}/tx/${h(3007)}`)
    })

    it('404 untuk id tidak ada dan untuk draft', async () => {
      await seed({ ledgerId: null, status: 'draft', commitTxHash: null, committedAt: null, maturesAt: null })
      expect((await get('/predictions/99')).statusCode).toBe(404)
    })

    it('400 untuk id tidak valid', async () => {
      expect((await get('/predictions/abc')).statusCode).toBe(400)
      expect((await get('/predictions/-1')).statusCode).toBe(400)
    })
  })

  describe('GET /rug-radar', () => {
    it('daftar launch dengan umur dan red flag', async () => {
      await db.insert(ponsTokens).values([
        { address: '0x3333333333333333333333333333333333333333', creator: '0xc', name: 'A', symbol: 'AAA', launchedAt: new Date(NOW.getTime() - 5_400_000), creatorTaxBps: 900, topHolderShareBps: 4200, redFlags: ['High creator tax'], blockNumber: 1n },
        { address: '0x4444444444444444444444444444444444444444', creator: '0xc', name: 'B', symbol: 'BBB', launchedAt: new Date(NOW.getTime() - 86_400_000), graduatedAt: new Date(NOW.getTime() - 3_600_000), blockNumber: 2n },
      ])
      const body = rugRadarResponseSchema.parse((await get('/rug-radar')).json())
      expect(body.items.map((i) => i.symbol)).toEqual(['AAA', 'BBB'])
      expect(body.items[0]).toMatchObject({ ageSeconds: 5400, graduated: false, redFlags: ['High creator tax'] })
      expect(body.items[1]?.graduated).toBe(true)
      expect(body.items[0]?.explorerUrl).toBe(`${EXPLORER}/address/0x3333333333333333333333333333333333333333`)
    })

    it('kosong tetap valid', async () => {
      expect(rugRadarResponseSchema.parse((await get('/rug-radar')).json()).items).toEqual([])
    })
  })

  it('GET /burn: keadaan nol sampai BurnVault ada', async () => {
    const body = burnResponseSchema.parse((await get('/burn')).json())
    expect(body.totalBurned.raw).toBe('0')
    expect(body.burns).toEqual([])
  })

  it('GET /healthz', async () => {
    expect((await get('/healthz')).json()).toEqual({ ok: true })
  })
})

describe('OpenAPI', () => {
  it('docs/api/openapi.json sinkron dengan skema (jalankan `pnpm --filter @nexa-ai/api openapi` jika gagal)', () => {
    const file = JSON.parse(readFileSync(new URL('../../../docs/api/openapi.json', import.meta.url), 'utf8'))
    expect(file).toEqual(JSON.parse(JSON.stringify(buildOpenApi())))
  })

  it('setiap path di OpenAPI punya route', () => {
    for (const path of Object.keys(buildOpenApi().paths)) {
      expect(app.hasRoute({ method: 'GET', url: path.replace(/\{(\w+)\}/g, ':$1') }), path).toBe(true)
    }
  })

  it('fixture sama bentuknya dengan response API: skema bersama', async () => {
    const { fixtures } = await import('@nexa-ai/api-client')
    expect(() => proofResponseSchema.parse(fixtures.proof)).not.toThrow()
  })
})
