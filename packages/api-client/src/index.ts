import { z } from 'zod'
import signalsWhalesFixture from '../../../docs/api/fixtures/signals-whales.json'
import alertFixture from '../../../docs/api/fixtures/alert.json'
import proPlanFixture from '../../../docs/api/fixtures/pro-plan.json'
import proSubscribeFixture from '../../../docs/api/fixtures/pro-subscribe.json'
import telegramLinkFixture from '../../../docs/api/fixtures/telegram-link.json'
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
import marketFixture from '../../../docs/api/fixtures/market.json'
import signalsFixture from '../../../docs/api/fixtures/signals.json'
import {
  signalsWhalesResponseSchema,
  type SignalsWhalesResponse,
  alertEventSchema,
  proPlanResponseSchema,
  proSubscribeResponseSchema,
  telegramLinkResponseSchema,
  type AlertEvent,
  type ProPlanResponse,
  type ProSubscribeResponse,
  type TelegramLinkResponse,
  askResponseSchema,
  burnResponseSchema,
  meResponseSchema,
  nonceResponseSchema,
  sessionResponseSchema,
  leaderboardResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  marketResponseSchema,
  signalsResponseSchema,
  type AskRequest,
  type ProSubscribeRequest,
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
  type MarketResponse,
  type SignalsResponse,
} from './schemas'

export * from './schemas'

/** Fixture dengan bentuk identik response asli; dipakai test dan `NEXT_PUBLIC_USE_FIXTURES=true`. */
export const fixtures = {
  proof: proofFixture,
  proofPopulated: proofPopulatedFixture,
  prediction: predictionFixture,
  rugRadar: rugRadarFixture,
  market: marketFixture,
  burn: burnFixture,
  signals: signalsFixture,
  ask: askFixture,
  leaderboard: leaderboardFixture,
  nonce: nonceFixture,
  session: sessionFixture,
  me: meFixture,
  proPlan: proPlanFixture,
  proSubscribe: proSubscribeFixture,
  telegramLink: telegramLinkFixture,
  alert: alertFixture,
  signalsWhales: signalsWhalesFixture,
} as const

/** Satu event SSE mentah (`event:`, `id:`, `data:`). Baris komentar (`:`) diabaikan. */
export interface SseMessage {
  event: string
  id: string | null
  data: string
}

/** Memecah teks SSE bertahap. Panggil `push` dengan potongan teks; kembalian = event yang sudah lengkap. */
export function createSseParser() {
  let buf = ''
  return {
    push(chunk: string): SseMessage[] {
      buf += chunk.replace(/\r\n/g, '\n')
      const out: SseMessage[] = []
      let i: number
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        let event = 'message'
        let id: string | null = null
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line === '' || line.startsWith(':')) continue
          const c = line.indexOf(':')
          const field = c === -1 ? line : line.slice(0, c)
          const value = c === -1 ? '' : line.slice(c + 1).replace(/^ /, '')
          if (field === 'event') event = value
          else if (field === 'id') id = value
          else if (field === 'data') data.push(value)
        }
        if (data.length > 0) out.push({ event, id, data: data.join('\n') })
      }
      return out
    },
  }
}

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
  /** Rencana NEXA Pro (harga, penerima, chain) untuk membangun transfer USDG. */
  async function getProPlan(): Promise<ProPlanResponse> {
    if (opts.useFixtures) return proPlanResponseSchema.parse(proPlanFixture)
    return send('GET', '/pro/plan', proPlanResponseSchema)
  }
  /** Daftarkan pembayaran USDG yang sudah terkonfirmasi; butuh sesi login. Memperpanjang masa aktif. */
  async function proSubscribe(req: ProSubscribeRequest, token: string): Promise<ProSubscribeResponse> {
    if (opts.useFixtures) return proSubscribeResponseSchema.parse(proSubscribeFixture)
    return send('POST', '/pro/subscribe', proSubscribeResponseSchema, { body: req, token })
  }
  /** Kode tautan Telegram untuk pelanggan aktif. */
  async function linkTelegram(token: string): Promise<TelegramLinkResponse> {
    if (opts.useFixtures) return telegramLinkResponseSchema.parse(telegramLinkFixture)
    return send('POST', '/pro/telegram/link', telegramLinkResponseSchema, { token, body: {} })
  }
  async function unlinkTelegram(token: string): Promise<void> {
    if (opts.useFixtures) return
    await send('POST', '/pro/telegram/unlink', null, { token, body: {} })
  }
  /**
   * Alert Pro real-time (SSE lewat fetch, supaya header Authorization bisa dikirim; EventSource tidak bisa).
   * Selesai bila stream ditutup atau `signal` dibatalkan. `lastEventId` melanjutkan dari alert terakhir yang diterima.
   */
  async function streamAlerts(o: { token: string; onAlert: (a: AlertEvent) => void; signal?: AbortSignal; lastEventId?: number }): Promise<void> {
    if (opts.useFixtures) {
      o.onAlert(alertEventSchema.parse(alertFixture))
      return
    }
    const headers: Record<string, string> = { accept: 'text/event-stream', authorization: `Bearer ${o.token}` }
    if (o.lastEventId !== undefined) headers['last-event-id'] = String(o.lastEventId)
    const res = await f(`${base()}/alerts/stream`, { headers, ...(o.signal ? { signal: o.signal } : {}) })
    if (!res.ok || !res.body) throw new Error(`API /alerts/stream: HTTP ${res.status}`)
    const parser = createSseParser()
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      for (const m of parser.push(value)) {
        if (m.event !== 'alert') continue
        const parsed = alertEventSchema.safeParse(JSON.parse(m.data))
        if (parsed.success) o.onAlert(parsed.data)
      }
    }
  }
  return {
    getProPlan,
    proSubscribe,
    linkTelegram,
    unlinkTelegram,
    streamAlerts,
    ask,
    getNonce,
    verify,
    me,
    logout,
    getProof: (): Promise<ProofResponse> =>
      get('/proof', proofResponseSchema, opts.proofFixture === 'populated' ? proofPopulatedFixture : proofFixture),
    getPrediction: (id: number): Promise<PredictionResponse> => get(`/predictions/${id}`, predictionResponseSchema, predictionFixture),
    getRugRadar: (): Promise<RugRadarResponse> => get('/rug-radar', rugRadarResponseSchema, rugRadarFixture),
    getMarket: (): Promise<MarketResponse> => get('/market', marketResponseSchema, marketFixture),
    getLeaderboard: (): Promise<LeaderboardResponse> => get('/leaderboard', leaderboardResponseSchema, leaderboardFixture),
    getBurn: (): Promise<BurnResponse> => get('/burn', burnResponseSchema, burnFixture),
    getSignals: (): Promise<SignalsResponse> => get('/signals', signalsResponseSchema, signalsFixture),
    getSignalsWhales: (): Promise<SignalsWhalesResponse> => get('/signals/whales', signalsWhalesResponseSchema, signalsWhalesFixture),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
