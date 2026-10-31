import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { askCreditUses, askPayments, authNonces, authSessions, createDb, ponsTokens } from '@nexa-ai/db'
import { askResponseSchema, meResponseSchema, nonceResponseSchema, sessionResponseSchema } from '@nexa-ai/api-client'
import { buildApp } from '../src/app'
import type { AuthConfig, HolderConfig } from '../src/auth'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test auth dilewati')
}

const NOW = new Date()
const DOMAIN = 'nexa.example'
const NEXA = '0x00000000000000000000000000000000000000ee' as const
const TOKEN = '0x00000000000000000000000000000000000000c3'
const THRESHOLD = 1_000n * 10n ** 18n

const holderAcct = privateKeyToAccount(generatePrivateKey())
const poorAcct = privateKeyToAccount(generatePrivateKey())
const balances: Record<string, bigint> = {
  [holderAcct.address.toLowerCase()]: 5_000n * 10n ** 18n,
  [poorAcct.address.toLowerCase()]: 10n ** 18n,
}
const holderCfg = (over: Partial<HolderConfig> = {}): HolderConfig => ({
  client: { readContract: async ({ args }: { args: readonly unknown[] }) => balances[String(args[0]).toLowerCase()] ?? 0n } as unknown as HolderConfig['client'],
  token: NEXA,
  threshold: THRESHOLD,
  decimals: 18,
  freeAsksPerMonth: 2,
  ...over,
})
const mk = (auth: Partial<AuthConfig> | null = {}, holder: HolderConfig | undefined = holderCfg()) =>
  buildApp({
    db,
    explorerUrl: 'https://explorer.example.test',
    paidFeaturesEnabled: true,
    now: () => NOW,
    // Ask harus terkonfigurasi agar /ask tidak 503; pembayaran USDG tidak dipakai di test ini.
    ask: { client: {} as never, usdg: NEXA, recipient: NEXA, minAmount: 1_000_000n },
    ...(auth === null ? {} : { auth: { domains: [DOMAIN], sessionTtlSeconds: 3600, nonceTtlSeconds: 300, holder, ...auth } }),
  })

type App = ReturnType<typeof mk>
const nonceOf = async (app: App) => nonceResponseSchema.parse((await app.inject({ method: 'GET', url: '/auth/nonce' })).json()).nonce

async function signIn(app: App, acct = holderAcct, over: { domain?: string; nonce?: string; issuedAt?: Date; tamper?: boolean } = {}) {
  const nonce = over.nonce ?? (await nonceOf(app))
  const message = createSiweMessage({
    address: acct.address,
    chainId: 4663,
    domain: over.domain ?? DOMAIN,
    nonce,
    uri: `https://${DOMAIN}`,
    version: '1',
    statement: 'Sign in to NEXA.',
    issuedAt: over.issuedAt ?? NOW,
  })
  const signature = await acct.signMessage({ message })
  return app.inject({ method: 'POST', url: '/auth/verify', payload: { message: over.tamper ? message.replace('Sign in', 'Sign up') : message, signature } })
}
const login = async (app: App, acct = holderAcct) => sessionResponseSchema.parse((await signIn(app, acct)).json())
const auth = (token: string) => ({ authorization: `Bearer ${token}` })

describe.skipIf(!dbUp)('login wallet (SIWE) dan benefit holder', () => {
  beforeEach(async () => {
    await db.delete(askCreditUses)
    await db.delete(askPayments)
    await db.delete(ponsTokens)
    await db.delete(authSessions)
    await db.delete(authNonces)
  })
  afterAll(async () => {
    await client.end()
  })

  it('mati (503) bila fitur berbayar mati atau auth belum dikonfigurasi', async () => {
    const off = buildApp({ db, explorerUrl: 'x', paidFeaturesEnabled: false, now: () => NOW, auth: { domains: [DOMAIN], sessionTtlSeconds: 1, nonceTtlSeconds: 1 } })
    expect((await off.inject({ method: 'GET', url: '/auth/nonce' })).statusCode).toBe(503)
    expect((await off.inject({ method: 'GET', url: '/me' })).statusCode).toBe(503)
    expect((await mk(null).inject({ method: 'GET', url: '/auth/nonce' })).statusCode).toBe(503)
  })

  it('alur penuh: nonce -> tanda tangan -> sesi -> /me -> logout', async () => {
    const app = mk()
    const s = await login(app)
    expect(s.address).toBe(getAddress(holderAcct.address))
    expect(s.token).toMatch(/^nexa_s_[0-9a-f]{64}$/)
    const me = meResponseSchema.parse((await app.inject({ method: 'GET', url: '/me', headers: auth(s.token) })).json())
    expect(me.holder).toMatchObject({ enabled: true, isHolder: true })
    expect(me.holder.balance!.formatted).toBe('5000')
    expect(me.benefits).toMatchObject({ earlyAlerts: true, freeAsksPerMonth: 2, freeAsksRemaining: 2 })
    expect((await app.inject({ method: 'POST', url: '/auth/logout', headers: auth(s.token) })).statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth(s.token) })).statusCode).toBe(401)
  })

  it('menolak: tanpa sesi, token salah, nonce dipakai ulang, nonce asing, domain lain, tanda tangan diubah, pesan basi', async () => {
    const app = mk()
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth('nexa_s_' + '0'.repeat(64)) })).statusCode).toBe(401)

    const nonce = await nonceOf(app)
    expect((await signIn(app, holderAcct, { nonce })).statusCode).toBe(200)
    const replay = await signIn(app, holderAcct, { nonce })
    expect(replay.statusCode).toBe(401)
    expect(replay.json().error).toBe('bad_nonce')

    expect((await signIn(app, holderAcct, { nonce: 'tidakpernahdibuat123' })).json().error).toBe('bad_nonce')
    expect((await signIn(app, holderAcct, { domain: 'evil.example' })).json().error).toBe('domain_mismatch')
    expect((await signIn(app, holderAcct, { tamper: true })).json().error).toBe('bad_signature')
    expect((await signIn(app, holderAcct, { issuedAt: new Date(NOW.getTime() - 11 * 60_000) })).json().error).toBe('expired_message')
    expect((await app.inject({ method: 'POST', url: '/auth/verify', payload: { message: 'bukan siwe', signature: '0x00' } })).json().error).toBe('invalid_message')
  })

  it('sesi kedaluwarsa tidak berlaku', async () => {
    const s = await login(mk())
    const later = buildApp({ db, explorerUrl: 'x', paidFeaturesEnabled: true, now: () => new Date(NOW.getTime() + 2 * 3600_000), auth: { domains: [DOMAIN], sessionTtlSeconds: 3600, nonceTtlSeconds: 300 } })
    expect((await later.inject({ method: 'GET', url: '/me', headers: auth(s.token) })).statusCode).toBe(401)
  })

  it('di bawah ambang bukan holder; tanpa konfigurasi holder benefit nonaktif; saldo tak terbaca tidak memberi benefit', async () => {
    const poor = await login(mk(), poorAcct)
    const me1 = meResponseSchema.parse((await mk().inject({ method: 'GET', url: '/me', headers: auth(poor.token) })).json())
    expect(me1.holder.isHolder).toBe(false)
    expect(me1.benefits).toMatchObject({ earlyAlerts: false, freeAsksPerMonth: 0, freeAsksRemaining: 0 })

    const noHolder = mk({ holder: undefined }) // tanpa konfigurasi holder
    const s = await login(noHolder)
    expect(meResponseSchema.parse((await noHolder.inject({ method: 'GET', url: '/me', headers: auth(s.token) })).json()).holder.enabled).toBe(false)

    const broken = mk({}, holderCfg({ client: { readContract: async () => { throw new Error('rpc mati') } } as unknown as HolderConfig['client'] }))
    const s2 = await login(broken)
    const me3 = meResponseSchema.parse((await broken.inject({ method: 'GET', url: '/me', headers: auth(s2.token) })).json())
    expect(me3.holder).toMatchObject({ enabled: true, isHolder: false, balance: null })
  })

  describe('Ask NEXA dengan kredit gratis holder', () => {
    const seed = () =>
      db.insert(ponsTokens).values({ address: getAddress(TOKEN), curve: '0x00000000000000000000000000000000000000ee', creator: getAddress(NEXA), name: 'T', symbol: 'TST', launchedAt: new Date(NOW.getTime() - 5 * 3_600_000), redFlags: [], blockNumber: 1n })
    const ask = (app: App, token?: string, address = TOKEN) =>
      app.inject({ method: 'POST', url: '/ask', headers: token ? auth(token) : {}, payload: { address } })

    it('tanpa txHash dan tanpa login: 401; bukan holder: 403', async () => {
      await seed()
      const app = mk()
      expect((await ask(app)).json().error).toBe('login_required')
      const poor = await login(app, poorAcct)
      const r = await ask(app, poor.token)
      expect(r.statusCode).toBe(403)
      expect(r.json().error).toBe('not_a_holder')
    })

    it('holder: laporan gratis, kredit berkurang per bulan, habis -> 402', async () => {
      await seed()
      const app = mk()
      const s = await login(app)
      const r1 = await ask(app, s.token)
      expect(r1.statusCode).toBe(200)
      expect(askResponseSchema.parse(r1.json()).paymentTxUrl).toBeNull()
      expect((await ask(app, s.token)).statusCode).toBe(200)
      const me = meResponseSchema.parse((await app.inject({ method: 'GET', url: '/me', headers: auth(s.token) })).json())
      expect(me.benefits.freeAsksRemaining).toBe(0)
      const r3 = await ask(app, s.token)
      expect(r3.statusCode).toBe(402)
      expect(r3.json().error).toBe('no_free_credits')
    })

    it('token tanpa data atau < 1 jam: kredit TIDAK terpakai', async () => {
      const app = mk()
      const s = await login(app)
      expect((await ask(app, s.token)).json().error).toBe('no_data')
      expect(await db.select().from(askCreditUses)).toHaveLength(0)
    })
  })
})
