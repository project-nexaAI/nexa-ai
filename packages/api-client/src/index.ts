import { z } from 'zod'
import askFixture from '../../../docs/api/fixtures/ask.json'
import burnFixture from '../../../docs/api/fixtures/burn.json'
import meFixture from '../../../docs/api/fixtures/me.json'
import nonceFixture from '../../../docs/api/fixtures/nonce.json'
import sessionFixture from '../../../docs/api/fixtures/session.json'
import leaderboardFixture from '../../../docs/api/fixtures/leaderboard.json'
import predictionFixture from '../../../docs/api/fixtures/prediction.json'
import proofFixture from '../../../docs/api/fixtures/proof.json'
import proofPopulatedFixture from '../../../docs/api/fixtures/proof.populated.json'
import rugRadarFixture from '../../../docs/api/fixtures/rug-radar.json'
import signalsFixture from '../../../docs/api/fixtures/signals.json'
import {
  askResponseSchema,
  burnResponseSchema,
  meResponseSchema,
  nonceResponseSchema,
  sessionResponseSchema,
  leaderboardResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
  type AskRequest,
  type MeResponse,
  type NonceResponse,
  type SessionResponse,
  type VerifyRequest,
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
  nonce: nonceFixture,
  session: sessionFixture,
  me: meFixture,
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
  const base = () => {
    if (!opts.baseUrl) throw new Error('baseUrl API belum di-set')
    return opts.baseUrl.replace(/\/$/, '')
  }
  async function send<T>(method: 'GET' | 'POST', path: string, schema: z.ZodType<T> | null, o: { body?: unknown; token?: string } = {}): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (o.body !== undefined) headers['content-type'] = 'application/json'
    if (o.token) headers.authorization = `Bearer ${o.token}`
    const res = await f(`${base()}${path}`, { method, headers, ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}) })
    if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`)
    return schema ? schema.parse(await res.json()) : (undefined as T)
  }

  /**
   * POST /ask: berbayar. Dengan `req.txHash`: tx pembayaran USDG harus sudah terkonfirmasi.
   * Tanpa txHash: kredit gratis holder, butuh `token` sesi login.
   */
  async function ask(req: AskRequest, token?: string): Promise<AskResponse> {
    if (opts.useFixtures) return askResponseSchema.parse(askFixture)
    return send('POST', '/ask', askResponseSchema, { body: req, ...(token ? { token } : {}) })
  }
  /** Login wallet (SIWE): getNonce -> tanda tangan di wallet -> verify -> sesi bearer. */
  async function getNonce(): Promise<NonceResponse> {
    if (opts.useFixtures) return nonceResponseSchema.parse(nonceFixture)
    return send('GET', '/auth/nonce', nonceResponseSchema)
  }
  async function verify(req: VerifyRequest): Promise<SessionResponse> {
    if (opts.useFixtures) return sessionResponseSchema.parse(sessionFixture)
    return send('POST', '/auth/verify', sessionResponseSchema, { body: req })
  }
  async function me(token: string): Promise<MeResponse> {
    if (opts.useFixtures) return meResponseSchema.parse(meFixture)
    return send('GET', '/me', meResponseSchema, { token })
  }
  async function logout(token: string): Promise<void> {
    if (opts.useFixtures) return
    await send('POST', '/auth/logout', null, { token, body: {} })
  }
  return {
    ask,
    getNonce,
    verify,
    me,
    logout,
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
