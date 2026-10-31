import { z } from 'zod'
import askFixture from '../../../docs/api/fixtures/ask.json'
import burnFixture from '../../../docs/api/fixtures/burn.json'
import leaderboardFixture from '../../../docs/api/fixtures/leaderboard.json'
import predictionFixture from '../../../docs/api/fixtures/prediction.json'
import proofFixture from '../../../docs/api/fixtures/proof.json'
import proofPopulatedFixture from '../../../docs/api/fixtures/proof.populated.json'
import rugRadarFixture from '../../../docs/api/fixtures/rug-radar.json'
import signalsFixture from '../../../docs/api/fixtures/signals.json'
import {
  askResponseSchema,
  burnResponseSchema,
  leaderboardResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
  type AskRequest,
  type AskResponse,
  type BurnResponse,
  type LeaderboardResponse,
  type PredictionResponse,
  type ProofResponse,
  type RugRadarResponse,
  type SignalsResponse,
} from './schemas'

export * from './schemas'

/** Fixture dengan bentuk identik response asli; dipakai test dan `NEXT_PUBLIC_USE_FIXTURES=true`. */
export const fixtures = {
  proof: proofFixture,
  proofPopulated: proofPopulatedFixture,
  prediction: predictionFixture,
  rugRadar: rugRadarFixture,
  burn: burnFixture,
  signals: signalsFixture,
  ask: askFixture,
  leaderboard: leaderboardFixture,
} as const

export interface ApiClientOptions {
  /** Basis URL API (mis. NEXT_PUBLIC_API_URL). Diabaikan jika useFixtures. */
  baseUrl?: string
  useFixtures?: boolean
  /** Varian fixture /proof: 'empty' (default, sebelum panggilan pertama dinilai) atau 'populated'. */
  proofFixture?: 'empty' | 'populated'
  fetchImpl?: typeof fetch
  /** Kunci Signals API (header x-api-key). Hanya dikirim ke /signals. */
  apiKey?: string
}

/** Dapat dipakai di browser maupun server. Setiap response divalidasi zod (input eksternal). */
export function createApiClient(opts: ApiClientOptions = {}) {
  const f = opts.fetchImpl ?? fetch
  async function get<T>(path: string, schema: z.ZodType<T>, fixture: unknown): Promise<T> {
    if (opts.useFixtures) return schema.parse(fixture)
    if (!opts.baseUrl) throw new Error('baseUrl API belum di-set')
    const headers: Record<string, string> = { accept: 'application/json' }
    if (opts.apiKey && path.startsWith('/signals')) headers['x-api-key'] = opts.apiKey
    const res = await f(`${opts.baseUrl.replace(/\/$/, '')}${path}`, { headers })
    if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`)
    return schema.parse(await res.json())
  }
  /** POST /ask: berbayar. Tx pembayaran USDG harus sudah terkonfirmasi sebelum dipanggil. */
  async function ask(req: AskRequest): Promise<AskResponse> {
    if (opts.useFixtures) return askResponseSchema.parse(askFixture)
    if (!opts.baseUrl) throw new Error('baseUrl API belum di-set')
    const res = await f(`${opts.baseUrl.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`API /ask: HTTP ${res.status}`)
    return askResponseSchema.parse(await res.json())
  }
  return {
    ask,
    getProof: (): Promise<ProofResponse> =>
      get('/proof', proofResponseSchema, opts.proofFixture === 'populated' ? proofPopulatedFixture : proofFixture),
    getPrediction: (id: number): Promise<PredictionResponse> => get(`/predictions/${id}`, predictionResponseSchema, predictionFixture),
    getRugRadar: (): Promise<RugRadarResponse> => get('/rug-radar', rugRadarResponseSchema, rugRadarFixture),
    getLeaderboard: (): Promise<LeaderboardResponse> => get('/leaderboard', leaderboardResponseSchema, leaderboardFixture),
    getBurn: (): Promise<BurnResponse> => get('/burn', burnResponseSchema, burnFixture),
    getSignals: (): Promise<SignalsResponse> => get('/signals', signalsResponseSchema, signalsFixture),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
