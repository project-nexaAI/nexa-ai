import { describe, expect, it } from 'vitest'
import {
  burnResponseSchema,
  createApiClient,
  fixtures,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
} from '../src'

describe('fixture cocok dengan skema response', () => {
  it('proof (kosong & terisi)', () => {
    expect(() => proofResponseSchema.parse(fixtures.proof)).not.toThrow()
    expect(() => proofResponseSchema.parse(fixtures.proofPopulated)).not.toThrow()
  })
  it('prediction', () => expect(() => predictionResponseSchema.parse(fixtures.prediction)).not.toThrow())
  it('rug-radar', () => expect(() => rugRadarResponseSchema.parse(fixtures.rugRadar)).not.toThrow())
  it('burn', () => expect(() => burnResponseSchema.parse(fixtures.burn)).not.toThrow())
  it('signals', () => expect(() => signalsResponseSchema.parse(fixtures.signals)).not.toThrow())
})

describe('createApiClient', () => {
  it('mode fixture mengembalikan data tervalidasi tanpa jaringan', async () => {
    const c = createApiClient({ useFixtures: true })
    expect((await c.getProof()).stats.winRate).toBeNull()
    expect((await c.getRugRadar()).items[0]?.redFlags).toContain('High creator tax')
    expect((await c.getPrediction(7)).revealed?.won).toBe(true)
  })

  it('varian proof terisi', async () => {
    const c = createApiClient({ useFixtures: true, proofFixture: 'populated' })
    const p = await c.getProof()
    expect(p.formatted.winRate).toBe('62.5%')
    expect(p.current?.day).toBe(4)
  })

  it('memanggil baseUrl dan memvalidasi response', async () => {
    const urls: string[] = []
    const c = createApiClient({
      baseUrl: 'https://api.example.test/',
      fetchImpl: (async (u: string) => {
        urls.push(u)
        return new Response(JSON.stringify(fixtures.burn), { status: 200 })
      }) as unknown as typeof fetch,
    })
    await c.getBurn()
    expect(urls).toEqual(['https://api.example.test/burn'])
  })

  it('menolak response yang bentuknya salah', async () => {
    const c = createApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 })) as unknown as typeof fetch,
    })
    await expect(c.getProof()).rejects.toThrow()
  })

  it('HTTP error dilempar', async () => {
    const c = createApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response('x', { status: 503 })) as unknown as typeof fetch,
    })
    await expect(c.getBurn()).rejects.toThrow(/503/)
  })
})
