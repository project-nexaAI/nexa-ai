import { createHash, randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, getAddress, parseAbi } from 'viem'
import {
  authSessions,
  createDb,
  postQueue,
  proAlerts,
  proPayments,
  proSubscriptions,
  telegramLinkCodes,
  telegramLinks,
} from '@nexa-ai/db'
import {
  createApiClient,
  meResponseSchema,
  proPlanResponseSchema,
  proSubscribeResponseSchema,
  telegramLinkResponseSchema,
  type AlertEvent,
} from '@nexa-ai/api-client'
import { buildApp } from '../src/app'
import type { ProConfig } from '../src/pro'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test Pro dilewati')
}

const NOW = new Date('2026-12-01T12:00:00.000Z')
const DAY = 86_400_000
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const
const TREASURY = '0x00000000000000000000000000000000000000a1' as const
const ALICE = getAddress('0x00000000000000000000000000000000000000b2')
const BOB = getAddress('0x00000000000000000000000000000000000000b3')
const PRICE = 19_000_000n
const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`
const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

const transferLog = (token: `0x${string}`, from: `0x${string}`, to: `0x${string}`, value: bigint) => ({
  address: token,
  topics: encodeEventTopics({ abi: transferAbi, eventName: 'Transfer', args: { from, to } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  blockHash: h(1),
  blockNumber: 1n,
  logIndex: 0,
  transactionHash: h(2),
  transactionIndex: 0,
  removed: false,
})

const receipts: Record<string, { status: 'success' | 'reverted'; logs: ReturnType<typeof transferLog>[] }> = {
  [h(10)]: { status: 'success', logs: [transferLog(USDG, ALICE, TREASURY, PRICE)] },
  [h(11)]: { status: 'success', logs: [transferLog(USDG, ALICE, TREASURY, PRICE - 1n)] }, // kurang
  [h(12)]: { status: 'success', logs: [transferLog(USDG, ALICE, BOB, PRICE)] }, // bukan ke penerima
  [h(13)]: { status: 'success', logs: [transferLog(USDG, BOB, TREASURY, PRICE)] }, // dikirim orang lain
  [h(14)]: { status: 'reverted', logs: [transferLog(USDG, ALICE, TREASURY, PRICE)] },
  [h(15)]: { status: 'success', logs: [transferLog(USDG, ALICE, TREASURY, PRICE)] },
  [h(16)]: { status: 'success', logs: [transferLog(USDG, ALICE, TREASURY, PRICE * 2n)] }, // dua periode
  [h(17)]: { status: 'success', logs: [transferLog('0x00000000000000000000000000000000000000ee', ALICE, TREASURY, PRICE)] }, // token palsu
}

const payment = (): ProConfig['payment'] => ({
  client: {
    getTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) => {
      const r = receipts[hash]
      if (!r) throw new Error('not found')
      return r
    },
  } as unknown as ProConfig['payment']['client'],
  usdg: USDG,
  recipient: TREASURY,
  minAmount: PRICE,
})

const mk = (o: { paid?: boolean; pro?: Partial<ProConfig> | null; now?: () => Date } = {}) =>
  buildApp({
    db,
    explorerUrl: 'https://explorer.example.test',
    paidFeaturesEnabled: o.paid ?? true,
    now: o.now ?? (() => NOW),
    auth: { domains: ['nexa.example'], sessionTtlSeconds: 3600, nonceTtlSeconds: 300 },
    ...(o.pro === null ? {} : { pro: { payment: payment(), days: 30, chainId: 4663, telegramBot: 'nexa_alerts_bot', alertPollMs: 25, heartbeatMs: 10_000, ...o.pro } }),
  })

/** Sesi login langsung di DB (alur SIWE-nya sudah diuji di auth.test). */
async function session(address: string): Promise<string> {
  const token = `nexa_s_${randomBytes(32).toString('hex')}`
  await db.insert(authSessions).values({ tokenHash: createHash('sha256').update(token).digest('hex'), address, expiresAt: new Date(NOW.getTime() + 3_600_000) })
  return token
}
const bearer = (t: string) => ({ authorization: `Bearer ${t}` })

async function seedAlert(content: string, publicAt: Date | null = null) {
  const [post] = await db.insert(postQueue).values({ kind: 'prediction', content, mode: 'dry', status: 'approved' }).returning({ id: postQueue.id })
  const [a] = await db.insert(proAlerts).values({ postId: post!.id, kind: 'prediction', content, publicAt }).returning({ id: proAlerts.id })
  return a!.id
}

async function clean() {
  await db.delete(proAlerts)
  await db.delete(postQueue)
  await db.delete(proPayments)
  await db.delete(proSubscriptions)
  await db.delete(telegramLinks)
  await db.delete(telegramLinkCodes)
  await db.delete(authSessions)
}

// proAlerts mereferensikan postQueue: bersihkan sebelum file lain (mis. test worker) menghapus post_queue.
afterAll(async () => {
  if (dbUp) await clean()
  await client.end()
})

describe.skipIf(!dbUp)('NEXA Pro: langganan', () => {
  beforeEach(clean)

  it('503 selama fitur berbayar mati atau Pro tidak dikonfigurasi', async () => {
    for (const app of [mk({ paid: false }), mk({ pro: null })]) {
      expect((await app.inject({ method: 'GET', url: '/pro/plan' })).statusCode).toBe(503)
      expect((await app.inject({ method: 'POST', url: '/pro/subscribe', payload: { txHash: h(10) } })).statusCode).toBe(503)
      expect((await app.inject({ method: 'POST', url: '/pro/telegram/link' })).statusCode).toBe(503)
      expect((await app.inject({ method: 'GET', url: '/alerts/stream' })).statusCode).toBe(503)
    }
  })

  it('GET /pro/plan: harga mentah dan terformat, penerima, chain', async () => {
    const r = await mk().inject({ method: 'GET', url: '/pro/plan' })
    expect(r.statusCode).toBe(200)
    expect(proPlanResponseSchema.parse(r.json())).toEqual({
      price: { raw: '19000000', decimals: 6, formatted: '19' },
      durationDays: 30,
      recipient: TREASURY,
      usdgAddress: USDG,
      chainId: 4663,
      telegramBot: 'nexa_alerts_bot',
    })
  })

  it('subscribe butuh login dan body yang valid', async () => {
    const app = mk()
    expect((await app.inject({ method: 'POST', url: '/pro/subscribe', payload: { txHash: h(10) } })).statusCode).toBe(401)
    const t = await session(ALICE)
    expect((await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: 'bukan-hash' } })).statusCode).toBe(400)
  })

  it('pembayaran tidak sah ditolak: kurang, bukan ke penerima, token palsu, tx gagal, tx tak ada', async () => {
    const app = mk()
    const t = await session(ALICE)
    const sub = (tx: `0x${string}`) => app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: tx } })
    expect((await sub(h(11))).json()).toEqual({ error: 'underpaid' })
    expect((await sub(h(12))).json()).toEqual({ error: 'no_payment' })
    expect((await sub(h(17))).json()).toEqual({ error: 'no_payment' })
    expect((await sub(h(14))).json()).toEqual({ error: 'tx_failed' })
    expect((await sub(h(99))).json()).toEqual({ error: 'tx_not_found' })
    expect((await sub(h(10))).statusCode).toBe(200) // kontrol: yang sah lolos
    expect(await db.select().from(proSubscriptions)).toHaveLength(1)
  })

  it('tx milik orang lain tidak bisa diklaim (payer_mismatch), dan tidak menghabiskan pembayaran', async () => {
    const app = mk()
    const t = await session(ALICE)
    const r = await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: h(13) } })
    expect(r.statusCode).toBe(403)
    expect(r.json()).toEqual({ error: 'payer_mismatch' })
    expect(await db.select().from(proPayments)).toHaveLength(0)
    // pengirim aslinya tetap bisa memakainya
    const bob = await session(BOB)
    expect((await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(bob), payload: { txHash: h(13) } })).statusCode).toBe(200)
  })

  it('subscribe sukses: aktif 30 hari, tercermin di /me, link Blockscout, tx tidak bisa dipakai ulang', async () => {
    const app = mk()
    const t = await session(ALICE)
    const r = await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: h(10) } })
    expect(r.statusCode).toBe(200)
    const body = proSubscribeResponseSchema.parse(r.json())
    expect(body).toMatchObject({ active: true, addedDays: 30, expiresAt: new Date(NOW.getTime() + 30 * DAY).toISOString() })
    expect(body.paymentTxUrl).toBe(`https://explorer.example.test/tx/${h(10)}`)

    const me = meResponseSchema.parse((await app.inject({ method: 'GET', url: '/me', headers: bearer(t) })).json())
    expect(me.pro).toEqual({ active: true, expiresAt: body.expiresAt, telegramLinked: false })

    const again = await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: h(10) } })
    expect(again.statusCode).toBe(409)
    expect(again.json()).toEqual({ error: 'payment_already_used' })
  })

  it('pembayaran kedua memperpanjang dari akhir masa aktif; kelipatan harga = kelipatan periode', async () => {
    const app = mk()
    const t = await session(ALICE)
    const sub = (tx: `0x${string}`) => app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: tx } })
    expect(proSubscribeResponseSchema.parse((await sub(h(10))).json()).expiresAt).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString())
    expect(proSubscribeResponseSchema.parse((await sub(h(15))).json()).expiresAt).toBe(new Date(NOW.getTime() + 60 * DAY).toISOString())
    const dbl = proSubscribeResponseSchema.parse((await sub(h(16))).json())
    expect(dbl.addedDays).toBe(60)
    expect(dbl.expiresAt).toBe(new Date(NOW.getTime() + 120 * DAY).toISOString())
  })

  it('langganan yang sudah habis: tidak aktif, dan perpanjangan dihitung dari sekarang', async () => {
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() - 5 * DAY) })
    const app = mk()
    const before = meResponseSchema.parse((await app.inject({ method: 'GET', url: '/me', headers: bearer(t) })).json())
    expect(before.pro.active).toBe(false)
    expect(before.pro.expiresAt).toBe(new Date(NOW.getTime() - 5 * DAY).toISOString())
    const r = proSubscribeResponseSchema.parse((await app.inject({ method: 'POST', url: '/pro/subscribe', headers: bearer(t), payload: { txHash: h(10) } })).json())
    expect(r.expiresAt).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString())
  })
})

describe.skipIf(!dbUp)('NEXA Pro: tautan Telegram', () => {
  beforeEach(clean)

  it('hanya pelanggan aktif yang boleh membuat kode', async () => {
    const app = mk()
    const t = await session(ALICE)
    expect((await app.inject({ method: 'POST', url: '/pro/telegram/link' })).statusCode).toBe(401)
    const r = await app.inject({ method: 'POST', url: '/pro/telegram/link', headers: bearer(t) })
    expect(r.statusCode).toBe(402)
    expect(r.json()).toEqual({ error: 'subscription_required' })
  })

  it('503 telegram_not_configured tanpa username bot', async () => {
    const app = mk({ pro: { telegramBot: undefined } })
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() + DAY) })
    const r = await app.inject({ method: 'POST', url: '/pro/telegram/link', headers: bearer(t) })
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ error: 'telegram_not_configured' })
  })

  it('kode sekali pakai berlaku 10 menit; kode baru menggantikan yang lama; unlink memutus chat', async () => {
    const app = mk()
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() + DAY) })
    const a = telegramLinkResponseSchema.parse((await app.inject({ method: 'POST', url: '/pro/telegram/link', headers: bearer(t) })).json())
    expect(a.url).toBe(`https://t.me/nexa_alerts_bot?start=${a.code}`)
    expect(a.expiresAt).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString())
    const b = telegramLinkResponseSchema.parse((await app.inject({ method: 'POST', url: '/pro/telegram/link', headers: bearer(t) })).json())
    expect(b.code).not.toBe(a.code)
    const codes = await db.select().from(telegramLinkCodes)
    expect(codes.map((c) => c.code)).toEqual([b.code])

    await db.insert(telegramLinks).values({ address: ALICE, chatId: '555' })
    const me = meResponseSchema.parse((await app.inject({ method: 'GET', url: '/me', headers: bearer(t) })).json())
    expect(me.pro.telegramLinked).toBe(true)
    expect((await app.inject({ method: 'POST', url: '/pro/telegram/unlink', headers: bearer(t) })).statusCode).toBe(204)
    expect(await db.select().from(telegramLinks)).toHaveLength(0)
  })
})

describe.skipIf(!dbUp)('NEXA Pro: GET /alerts/stream (SSE)', () => {
  beforeEach(clean)

  async function serve(over: Parameters<typeof mk>[0] = {}) {
    const app = mk(over)
    await app.listen({ port: 0, host: '127.0.0.1' })
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
    return { app, base, client: createApiClient({ baseUrl: base }) }
  }
  const waitFor = async (cond: () => boolean, ms = 3000) => {
    const t0 = Date.now()
    while (!cond()) {
      if (Date.now() - t0 > ms) throw new Error('timeout menunggu alert')
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  it('butuh login dan langganan aktif', async () => {
    const { app, base } = await serve()
    try {
      expect((await fetch(`${base}/alerts/stream`)).status).toBe(401)
      const t = await session(ALICE)
      const r = await fetch(`${base}/alerts/stream`, { headers: bearer(t) })
      expect(r.status).toBe(402)
      await r.text()
    } finally {
      await app.close()
    }
  })

  it('hanya alert baru yang dikirim; yang lama tidak diulang; urutan dan isi benar', async () => {
    await seedAlert('lama: tidak boleh muncul')
    const { app, client: api } = await serve()
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() + DAY) })
    const got: AlertEvent[] = []
    const ctl = new AbortController()
    const done = api.streamAlerts({ token: t, signal: ctl.signal, onAlert: (a) => got.push(a) }).catch(() => undefined)
    try {
      await new Promise((r) => setTimeout(r, 150)) // stream sudah tersambung
      const publicAt = new Date('2026-12-01T12:15:00.000Z')
      await seedAlert('baru satu', publicAt)
      await seedAlert('baru dua')
      await waitFor(() => got.length >= 2)
      expect(got.map((a) => a.content)).toEqual(['baru satu', 'baru dua'])
      expect(got[0]).toMatchObject({ kind: 'prediction', publicAt: publicAt.toISOString() })
      expect(got[1]!.publicAt).toBeNull()
      expect(got[0]!.id).toBeLessThan(got[1]!.id)
    } finally {
      ctl.abort()
      await done
      await app.close()
    }
  })

  it('Last-Event-ID melanjutkan dari alert yang terlewat', async () => {
    const first = await seedAlert('satu')
    await seedAlert('dua')
    await seedAlert('tiga')
    const { app, client: api } = await serve()
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() + DAY) })
    const got: AlertEvent[] = []
    const ctl = new AbortController()
    const done = api.streamAlerts({ token: t, signal: ctl.signal, lastEventId: first, onAlert: (a) => got.push(a) }).catch(() => undefined)
    try {
      await waitFor(() => got.length >= 2)
      expect(got.map((a) => a.content)).toEqual(['dua', 'tiga'])
    } finally {
      ctl.abort()
      await done
      await app.close()
    }
  })

  it('stream ditutup saat server dimatikan (tidak menggantung)', async () => {
    const { app, base } = await serve()
    const t = await session(ALICE)
    await db.insert(proSubscriptions).values({ address: ALICE, expiresAt: new Date(NOW.getTime() + DAY) })
    const res = await fetch(`${base}/alerts/stream`, { headers: bearer(t) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    await reader.read() // komentar "connected"
    await app.close()
    for (;;) {
      const { done } = await reader.read()
      if (done) break
    }
    // server menunggu koneksi keep-alive idle sebelum benar-benar tutup, jadi batas waktunya dilonggarkan
  }, 20_000)
})
