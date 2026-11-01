import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { apiKeys, burns, kolAccounts, kolCalls, createDb, ponsTokens, postQueue, proAlerts, predictions, priceSnapshots, whaleTransfers } from '@nexa-ai/db'
import {
  signalsWhalesResponseSchema,
  burnResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  marketResponseSchema,
  signalsResponseSchema,
  leaderboardResponseSchema,
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
    await db.delete(proAlerts)
    await db.delete(postQueue)
    await db.delete(kolCalls)
    await db.delete(kolAccounts)
    await db.delete(apiKeys)
    await db.delete(predictions)
    await db.delete(ponsTokens)
    await db.delete(priceSnapshots)
    await db.delete(burns)
    await db.delete(whaleTransfers)
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

  describe('GET /market', () => {
    const at = (minsAgo: number) => new Date(NOW.getTime() - minsAgo * 60_000)
    const snap = (asset: string, source: 'oracle' | 'dex', price: bigint, minsAgo: number) => ({ asset, source, price: price.toString(), decimals: 8, at: at(minsAgo) })

    it('kosong tetap valid', async () => {
      expect(marketResponseSchema.parse((await get('/market')).json()).assets).toEqual([])
    })

    it('oracle vs DEX: selisih, perubahan 24 jam, seri berpasangan; urut dari gerak terbesar', async () => {
      await db.insert(priceSnapshots).values([
        snap('NVDA', 'oracle', 21_000_000_000n, 1380), snap('NVDA', 'dex', 20_900_000_000n, 1380),
        snap('NVDA', 'oracle', 20_000_000_000n, 0), snap('NVDA', 'dex', 19_900_000_000n, 0),
        snap('ETH', 'oracle', 220_000_000_000n, 1380), snap('ETH', 'oracle', 224_400_000_000n, 0),
      ])
      const body = marketResponseSchema.parse((await get('/market')).json())
      expect(body.assets.map((a) => a.symbol)).toEqual(['NVDA', 'ETH']) // NVDA -4,76% > ETH +2,00%
      const nvda = body.assets[0]!
      expect(nvda.oracle).toEqual({ raw: '20000000000', decimals: 8, formatted: '200.00' })
      expect(nvda.dex?.formatted).toBe('199.00')
      expect(nvda.gapBps).toBe(-50)
      expect(nvda.gapFormatted).toBe('-0.50%')
      expect(nvda.changeBps).toBe(-476)
      expect(nvda.windowHours).toBe(23)
      expect(nvda.series).toEqual([
        { at: at(1380).toISOString(), oracle: '21000000000', dex: '20900000000' },
        { at: at(0).toISOString(), oracle: '20000000000', dex: '19900000000' },
      ])
      const eth = body.assets[1]!
      expect(eth.dex).toBeNull()
      expect(eth.gapBps).toBeNull()
      expect(eth.changeBps).toBe(200)
    })

    it('riwayat kurang dari 1 jam: tanpa perubahan (tidak menebak); data lebih dari 24 jam diabaikan', async () => {
      await db.insert(priceSnapshots).values([snap('NVDA', 'oracle', 20_000_000_000n, 1500), snap('NVDA', 'oracle', 20_100_000_000n, 30), snap('NVDA', 'oracle', 20_200_000_000n, 0)])
      const nvda = marketResponseSchema.parse((await get('/market')).json()).assets[0]!
      expect(nvda.changeBps).toBeNull()
      expect(nvda.windowHours).toBeNull()
      expect(nvda.series).toHaveLength(2)
    })
  })

  describe('GET /burn', () => {
    it('kosong: total nol', async () => {
      const body = burnResponseSchema.parse((await get('/burn')).json())
      expect(body.totalBurned).toEqual({ raw: '0', decimals: 18, formatted: '0' })
      expect(body.burns).toEqual([])
    })

    it('menjumlahkan semua burn, terbaru dulu, dengan link Blockscout', async () => {
      await db.insert(burns).values([
        { id: `${h(1)}-0`, txHash: h(1), nexaBurned: '1500000000000000000', pairSpent: '10', at: day(2), blockNumber: 10n },
        { id: `${h(2)}-3`, txHash: h(2), nexaBurned: '2500000000000000000000', pairSpent: '20', at: day(1), blockNumber: 20n },
      ])
      const body = burnResponseSchema.parse((await get('/burn')).json())
      expect(body.totalBurned).toEqual({ raw: '2501500000000000000000', decimals: 18, formatted: '2501.5' })
      expect(body.burns.map((b) => b.txHash)).toEqual([h(2), h(1)])
      expect(body.burns[0]!.amount.formatted).toBe('2500')
      expect(body.burns[0]!.txUrl).toBe(`${EXPLORER}/tx/${h(2)}`)
    })
  })

  describe('GET /signals (berbayar)', () => {
    const KEY = 'nexa_test_key_123'
    const paid = buildApp({ db, explorerUrl: EXPLORER, paidFeaturesEnabled: true, signalsRateLimitPerMinute: 3, now: () => NOW })
    const call = (key?: string, query = '') => paid.inject({ method: 'GET', url: `/signals${query}`, headers: key ? { 'x-api-key': key } : {} })
    const addKey = (key: string, active = true) =>
      db.insert(apiKeys).values({ keyHash: createHash('sha256').update(key).digest('hex'), label: 'test', active })

    it('mati (503) selama PAID_FEATURES_ENABLED=false, meski kunci valid', async () => {
      await addKey(KEY)
      const res = await app.inject({ method: 'GET', url: '/signals', headers: { 'x-api-key': KEY } })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toEqual({ error: 'paid_features_disabled' })
    })

    it('tanpa kunci atau kunci salah atau kunci nonaktif: 401', async () => {
      await addKey(KEY)
      await addKey('nonaktif', false)
      expect((await call()).statusCode).toBe(401)
      expect((await call('salah')).statusCode).toBe(401)
      expect((await call('nonaktif')).statusCode).toBe(401)
    })

    it('200: hanya post yang sudah terbit, terbaru dulu, dengan ledgerId bila prediksi', async () => {
      await addKey(KEY)
      await seed({ ledgerId: 5, status: 'posted' })
      const [pred] = await db.select().from(predictions)
      await db.insert(postQueue).values([
        { kind: 'prediction_of_the_day', content: 'lama', status: 'posted', postedAt: day(2), predictionId: pred!.id },
        { kind: 'daily_summary', content: 'baru', status: 'posted', postedAt: day(1) },
        { kind: 'daily_summary', content: 'belum terbit', status: 'approved' },
        { kind: 'daily_summary', content: 'menunggu', status: 'pending_approval' },
      ])
      const res = await call(KEY)
      expect(res.statusCode).toBe(200)
      const body = signalsResponseSchema.parse(res.json())
      expect(body.items.map((i) => i.content)).toEqual(['baru', 'lama'])
      expect(body.items[0]!.ledgerId).toBeNull()
      expect(body.items[1]!.ledgerId).toBe(5)
      expect(res.headers['cache-control']).toBe('private, no-store')
    })

    describe('GET /signals/whales', () => {
      const NVDA = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'
      const withSymbols = buildApp({ db, explorerUrl: EXPLORER, paidFeaturesEnabled: true, now: () => NOW, symbols: { [NVDA.toLowerCase()]: 'NVDA' } })
      const whales = (key?: string, query = '') => withSymbols.inject({ method: 'GET', url: `/signals/whales${query}`, headers: key ? { 'x-api-key': key } : {} })
      const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
      const row = (n: number, over: Partial<typeof whaleTransfers.$inferInsert> = {}) => ({
        id: `${tx(n)}-3`,
        token: NVDA,
        from: '0x00000000000000000000000000000000000000d1',
        to: '0x00000000000000000000000000000000000000d2',
        amount: '1500500000000000000000',
        decimals: 18,
        at: day(n),
        blockNumber: BigInt(n),
        ...over,
      })

      it('sama dengan /signals: 503 saat flag mati, 401 tanpa kunci, 429 bila melewati batas laju', async () => {
        await addKey(KEY)
        expect((await app.inject({ method: 'GET', url: '/signals/whales', headers: { 'x-api-key': KEY } })).statusCode).toBe(503)
        expect((await whales()).statusCode).toBe(401)
        expect((await whales('salah')).statusCode).toBe(401)
        const limited = buildApp({ db, explorerUrl: EXPLORER, paidFeaturesEnabled: true, signalsRateLimitPerMinute: 1, now: () => NOW })
        const hit = () => limited.inject({ method: 'GET', url: '/signals/whales', headers: { 'x-api-key': KEY } })
        expect((await hit()).statusCode).toBe(200)
        expect((await hit()).statusCode).toBe(429)
      })

      it('200: terbaru dulu, nilai mentah + terformat, simbol bila dikenal, link Blockscout ke tx', async () => {
        await addKey(KEY)
        await db.insert(whaleTransfers).values([row(3), row(1, { token: '0x00000000000000000000000000000000000000aa', amount: '5' , decimals: 0 })])
        const res = await whales(KEY)
        expect(res.statusCode).toBe(200)
        const body = signalsWhalesResponseSchema.parse(res.json())
        // day(1) lebih baru daripada day(3): urutan terbaru dulu
        expect(body.items.map((i) => i.txHash)).toEqual([tx(1), tx(3)])
        const nv = body.items.find((i) => i.token === NVDA)!
        expect(nv).toMatchObject({ symbol: 'NVDA', amount: { raw: '1500500000000000000000', decimals: 18, formatted: '1500.5' }, txHash: tx(3), txUrl: `${EXPLORER}/tx/${tx(3)}` })
        expect(body.items.find((i) => i.token !== NVDA)!.symbol).toBeNull()
        expect(res.headers['cache-control']).toBe('private, no-store')
      })

      it('limit divalidasi dan dipakai', async () => {
        await addKey(KEY)
        await db.insert(whaleTransfers).values([row(1), row(2), row(3)])
        expect((await whales(KEY, '?limit=0')).statusCode).toBe(400)
        expect(signalsWhalesResponseSchema.parse((await whales(KEY, '?limit=2')).json()).items).toHaveLength(2)
      })
    })

    it('limit divalidasi', async () => {
      await addKey(KEY)
      expect((await call(KEY, '?limit=0')).statusCode).toBe(400)
      expect((await call(KEY, '?limit=101')).statusCode).toBe(400)
    })

    it('batas laju per kunci: permintaan ke-4 dalam semenit = 429 + Retry-After', async () => {
      await addKey(KEY)
      for (let i = 0; i < 3; i++) expect((await call(KEY)).statusCode).toBe(200)
      const res = await call(KEY)
      expect(res.statusCode).toBe(429)
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    })
  })

  describe('GET /leaderboard', () => {
    const kol = async (handle: string, optedIn: boolean, calls: { dir: 1 | 2; ret: number | null; won?: boolean }[]) => {
      const [k] = await db.insert(kolAccounts).values({ handle, displayName: handle.toUpperCase(), optedIn }).returning()
      for (const c of calls)
        await db.insert(kolCalls).values({
          kolId: k!.id, text: 't', asset: NVDA, direction: c.dir, madeAt: day(10), maturesAt: day(3), sourceUrl: 'https://x.com/a/status/1',
          startPrice: '10000000000', priceDecimals: 8,
          ...(c.ret === null ? {} : { endPrice: '1', scoredAt: day(2), returnBps: c.ret, won: c.won ?? false }),
        })
    }

    it('kosong: hanya baris NEXA, tanpa peringkat', async () => {
      const res = await app.inject({ method: 'GET', url: '/leaderboard' })
      const body = leaderboardResponseSchema.parse(res.json())
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0]).toMatchObject({ handle: 'nexa', isNexa: true, scored: 0, rank: null, winRate: null })
    })

    it('peringkat: win rate turun; di bawah minScored tanpa rank; yang tidak opted-in tidak tampil; return searah klaim', async () => {
      await kol('alpha', true, [{ dir: 1, ret: 500, won: true }, { dir: 1, ret: 100, won: true }, { dir: 2, ret: -200, won: true }])
      await kol('beta', true, [{ dir: 1, ret: 300, won: true }, { dir: 1, ret: -100 }, { dir: 1, ret: -100 }, { dir: 1, ret: null }])
      await kol('baru', true, [{ dir: 1, ret: 900, won: true }])
      await kol('tersembunyi', false, [{ dir: 1, ret: 900, won: true }, { dir: 1, ret: 900, won: true }, { dir: 1, ret: 900, won: true }])
      const res = await app.inject({ method: 'GET', url: '/leaderboard' })
      const body = leaderboardResponseSchema.parse(res.json())
      const by = Object.fromEntries(body.entries.map((e) => [e.handle, e]))
      expect(by.tersembunyi).toBeUndefined()
      expect(by.alpha).toMatchObject({ rank: 1, scored: 3, wins: 3, winRate: 1, avgReturnBps: 267 })
      expect(by.alpha!.formatted).toEqual({ winRate: '100.0%', avgReturn: '+2.67%' })
      expect(by.beta).toMatchObject({ rank: 2, scored: 3, wins: 1, pending: 1 })
      expect(by.baru).toMatchObject({ rank: null, scored: 1 })
      expect(body.entries.map((e) => e.handle).slice(0, 2)).toEqual(['alpha', 'beta'])
    })
  })

  describe('CORS', () => {
    it('beberapa asal dipisah koma: keduanya diizinkan, asal lain tidak', async () => {
      const multi = buildApp({ db, explorerUrl: EXPLORER, now: () => NOW, webOrigin: 'https://a.test, https://b.test/' })
      const acao = async (origin: string) => (await multi.inject({ method: 'GET', url: '/healthz', headers: { origin } })).headers['access-control-allow-origin']
      expect(await acao('https://a.test')).toBe('https://a.test')
      expect(await acao('https://b.test')).toBe('https://b.test')
      expect(await acao('https://evil.test')).toBeUndefined()
    })
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
    for (const [path, ops] of Object.entries(buildOpenApi().paths)) {
      for (const method of Object.keys(ops)) {
        expect(app.hasRoute({ method: method.toUpperCase() as 'GET' | 'POST', url: path.replace(/\{(\w+)\}/g, ':$1') }), `${method} ${path}`).toBe(true)
      }
    }
  })

  it('fixture sama bentuknya dengan response API: skema bersama', async () => {
    const { fixtures } = await import('@nexa-ai/api-client')
    expect(() => proofResponseSchema.parse(fixtures.proof)).not.toThrow()
  })
})
