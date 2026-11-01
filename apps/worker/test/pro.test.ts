import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createDb,
  indexerState,
  postQueue,
  proAlerts,
  proSubscriptions,
  riskguardLog,
  telegramLinkCodes,
  telegramLinks,
} from '@nexa-ai/db'
import { dispatchProAlerts, handleTelegramUpdate, pollTelegram } from '../src/pro'
import { approvePost, enqueuePost, recordProAlert } from '../src/queue'
import { TelegramApi, TelegramError, type ChatSender, type TelegramUpdate } from '../src/telegram'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test Pro worker dilewati')
}

const NOW = new Date('2026-12-01T12:00:00.000Z')
const MIN = 60_000
const DAY = 86_400_000
const A = '0x00000000000000000000000000000000000000b2'
const B = '0x00000000000000000000000000000000000000b3'
const C = '0x00000000000000000000000000000000000000b4'

/** Pengirim palsu: mencatat pesan; `fail` memetakan chatId ke galat yang dilempar. */
class FakeSender implements ChatSender {
  readonly sent: { chatId: string; text: string }[] = []
  constructor(private readonly fail: Record<string, Error> = {}) {}
  async sendMessage(chatId: string, text: string) {
    const f = this.fail[chatId]
    if (f) throw f
    this.sent.push({ chatId, text })
  }
}

const summary = (text: string) => ({ kind: 'daily_summary', mode: 'dry', input: { type: 'daily_summary', text, dataComplete: true } }) as const

async function addAlert(content: string, publicAt: Date | null) {
  const [post] = await db.insert(postQueue).values({ kind: 'daily_summary', content, mode: 'dry', status: 'approved', scheduledAt: publicAt }).returning()
  await recordProAlert(db, post!)
  return post!.id
}
const sub = (address: string, offsetMs: number) => db.insert(proSubscriptions).values({ address, expiresAt: new Date(NOW.getTime() + offsetMs) })
const link = (address: string, chatId: string) => db.insert(telegramLinks).values({ address, chatId })
const msg = (text: string, chatId = 777, type = 'private'): TelegramUpdate => ({ update_id: 1, message: { chat: { id: chatId, type }, text } })

async function clean() {
  await db.delete(proAlerts)
  await db.delete(postQueue)
  await db.delete(riskguardLog)
  await db.delete(proSubscriptions)
  await db.delete(telegramLinks)
  await db.delete(telegramLinkCodes)
  await db.delete(indexerState)
}

afterAll(async () => {
  if (dbUp) await clean()
  await client.end()
})

describe.skipIf(!dbUp)('alert Pro dibuat saat post disetujui', () => {
  beforeEach(clean)

  it('persetujuan manusia membuat alert dengan jadwal publik 15 menit; ditolak/diblokir/pending tidak', async () => {
    const pending = await enqueuePost(db, { ...summary('Ringkasan NVDA satu.'), now: NOW })
    expect(pending.status).toBe('pending_approval')
    expect(await db.select().from(proAlerts)).toHaveLength(0) // belum disetujui: belum ada alert

    await approvePost(db, pending.id)
    const [a] = await db.select().from(proAlerts)
    expect(a).toMatchObject({ postId: pending.id, kind: 'daily_summary', content: 'Ringkasan NVDA satu.' })
    expect(a!.publicAt!.getTime()).toBe(NOW.getTime() + 15 * MIN)

    const blocked = await enqueuePost(db, { ...summary('Sekarang waktunya beli NVDA'), now: NOW })
    expect(blocked.status).toBe('rejected')
    expect(await db.select().from(proAlerts)).toHaveLength(1)
  })

  it('post yang lolos otomatis (mode approval risky) langsung jadi alert; idempoten per post', async () => {
    const r = await enqueuePost(db, { ...summary('Ringkasan NVDA dua.'), now: NOW, riskguardConfig: { approvalMode: 'risky' } })
    expect(r.status).toBe('approved')
    const [post] = await db.select().from(postQueue)
    await recordProAlert(db, post!) // dipanggil ulang: tidak menggandakan
    expect(await db.select().from(proAlerts)).toHaveLength(1)
  })
})

describe.skipIf(!dbUp)('dispatchProAlerts', () => {
  beforeEach(clean)
  const publicLater = new Date(NOW.getTime() + 15 * MIN)

  it('mengirim hanya ke pelanggan aktif yang menautkan Telegram, dengan jam post publik', async () => {
    await addAlert('Isi alert.', publicLater)
    await sub(A, DAY) // aktif + tertaut
    await link(A, '111')
    await sub(B, -DAY) // kedaluwarsa + tertaut
    await link(B, '222')
    await link(C, '333') // tertaut tanpa langganan
    await sub('0x00000000000000000000000000000000000000b5', DAY) // aktif tanpa Telegram

    const s = new FakeSender()
    const r = await dispatchProAlerts(db, s, NOW)
    expect(r).toEqual({ alerts: 1, sent: 1, failed: 0, skippedPublic: 0 })
    expect(s.sent).toEqual([{ chatId: '111', text: 'Isi alert.\n\nPublic on X around 12:15 UTC.' }])
  })

  it('setiap alert diklaim sekali: putaran kedua tidak mengirim ulang', async () => {
    await addAlert('Satu kali saja.', publicLater)
    await sub(A, DAY)
    await link(A, '111')
    const s = new FakeSender()
    await dispatchProAlerts(db, s, NOW)
    const again = await dispatchProAlerts(db, s, NOW)
    expect(again.alerts).toBe(0)
    expect(s.sent).toHaveLength(1)
  })

  it('alert yang jadwal publiknya sudah lewat tidak dikirim (nilai Pro adalah lebih awal)', async () => {
    await addAlert('Sudah basi.', new Date(NOW.getTime() - MIN))
    await sub(A, DAY)
    await link(A, '111')
    const s = new FakeSender()
    const r = await dispatchProAlerts(db, s, NOW)
    expect(r).toMatchObject({ alerts: 1, sent: 0, skippedPublic: 1 })
    expect(s.sent).toEqual([])
    expect((await db.select().from(proAlerts))[0]!.telegramDispatchedAt).not.toBeNull() // ditandai selesai
  })

  it('403 (bot diblokir) melepas tautan; galat lain dihitung gagal; yang lain tetap menerima', async () => {
    await addAlert('Untuk semua.', publicLater)
    for (const [addr, chat] of [[A, '111'], [B, '222'], [C, '333']] as const) {
      await sub(addr, DAY)
      await link(addr, chat)
    }
    const s = new FakeSender({ '111': new TelegramError(403), '222': new TelegramError(500) })
    const r = await dispatchProAlerts(db, s, NOW)
    expect(r).toMatchObject({ sent: 1, failed: 2 })
    expect(s.sent.map((x) => x.chatId)).toEqual(['333'])
    const links = (await db.select().from(telegramLinks)).map((l) => l.chatId).sort()
    expect(links).toEqual(['222', '333']) // hanya yang memblokir bot yang dilepas
  })
})

describe.skipIf(!dbUp)('handleTelegramUpdate', () => {
  beforeEach(clean)
  const code = 'abcdef0123456789abcdef01'
  const putCode = (address: string, offsetMs = 10 * MIN) => db.insert(telegramLinkCodes).values({ code, address, expiresAt: new Date(NOW.getTime() + offsetMs) })

  it('/start <kode> menautkan chat ke alamat pemilik kode, lalu kode hangus', async () => {
    await sub(A, DAY)
    await putCode(A)
    const s = new FakeSender()
    await handleTelegramUpdate(db, s, msg(`/start ${code}`), NOW)
    expect(await db.select().from(telegramLinks)).toEqual([expect.objectContaining({ address: A, chatId: '777' })])
    expect(await db.select().from(telegramLinkCodes)).toHaveLength(0)
    expect(s.sent[0]!.text).toMatch(/^Connected/)

    await handleTelegramUpdate(db, s, msg(`/start ${code}`, 888), NOW) // kode yang sama dari chat lain
    expect(s.sent[1]!.text).toMatch(/invalid or has expired/)
    expect(await db.select().from(telegramLinks)).toHaveLength(1)
  })

  it('kode kedaluwarsa atau tidak dikenal ditolak', async () => {
    await sub(A, DAY)
    await putCode(A, -MIN)
    const s = new FakeSender()
    await handleTelegramUpdate(db, s, msg(`/start ${code}`), NOW)
    await handleTelegramUpdate(db, s, msg('/start zzzzzzzzzzzzzzzz'), NOW)
    expect(s.sent.map((x) => x.text.slice(0, 16))).toEqual(['That code is inv', 'That code is inv'])
    expect(await db.select().from(telegramLinks)).toHaveLength(0)
  })

  it('langganan tidak aktif: tidak menautkan', async () => {
    await sub(A, -DAY)
    await putCode(A)
    const s = new FakeSender()
    await handleTelegramUpdate(db, s, msg(`/start ${code}`), NOW)
    expect(s.sent[0]!.text).toMatch(/not active/)
    expect(await db.select().from(telegramLinks)).toHaveLength(0)
  })

  it('satu chat hanya satu alamat: menautkan chat yang sama ke alamat lain memindahkannya', async () => {
    await sub(A, DAY)
    await sub(B, DAY)
    await link(A, '777')
    await db.insert(telegramLinkCodes).values({ code, address: B, expiresAt: new Date(NOW.getTime() + 10 * MIN) })
    await handleTelegramUpdate(db, new FakeSender(), msg(`/start ${code}`), NOW)
    expect(await db.select().from(telegramLinks)).toEqual([expect.objectContaining({ address: B, chatId: '777' })])
  })

  it('/stop memutus; /start tanpa kode dan pesan lain dibalas bantuan; chat grup diabaikan', async () => {
    await link(A, '777')
    const s = new FakeSender()
    await handleTelegramUpdate(db, s, msg('/stop'), NOW)
    expect(await db.select().from(telegramLinks)).toHaveLength(0)
    await handleTelegramUpdate(db, s, msg('/start'), NOW)
    await handleTelegramUpdate(db, s, msg('halo'), NOW)
    expect(s.sent.slice(1).every((x) => x.text.startsWith('NEXA Pro alerts'))).toBe(true)
    const before = s.sent.length
    await handleTelegramUpdate(db, s, msg('/stop', 777, 'group'), NOW)
    await handleTelegramUpdate(db, s, { update_id: 2 }, NOW)
    expect(s.sent).toHaveLength(before)
  })
})

describe.skipIf(!dbUp)('pollTelegram', () => {
  beforeEach(clean)

  it('menyimpan kursor dan memakainya di putaran berikutnya; satu update gagal tidak memblokir', async () => {
    await sub(A, DAY)
    await db.insert(telegramLinkCodes).values({ code: 'abcdef0123456789abcdef01', address: A, expiresAt: new Date(Date.now() + 10 * MIN) })
    const offsets: number[] = []
    const queue: TelegramUpdate[][] = [
      [
        { update_id: 10, message: { chat: { id: 5, type: 'private' }, text: 'rusak' } }, // pengiriman balasan gagal
        { update_id: 11, message: { chat: { id: 6, type: 'private' }, text: '/start abcdef0123456789abcdef01' } },
      ],
      [],
    ]
    const sent: string[] = []
    const api = {
      getUpdates: async (offset: number) => {
        offsets.push(offset)
        return queue.shift() ?? []
      },
      sendMessage: async (chatId: string) => {
        if (chatId === '5') throw new TelegramError(500)
        sent.push(chatId)
      },
    }
    expect(await pollTelegram(db, api, 0)).toBe(2)
    expect(await pollTelegram(db, api, 0)).toBe(0)
    expect(offsets).toEqual([0, 12])
    expect(sent).toEqual(['6'])
    expect(await db.select().from(telegramLinks)).toEqual([expect.objectContaining({ address: A, chatId: '6' })])
  })
})

describe('TelegramApi', () => {
  it('memanggil sendMessage/getUpdates; galat hanya memuat status, bukan token', async () => {
    const calls: { url: string; body: unknown }[] = []
    const ok = new TelegramApi('SECRET-TOKEN', (async (u: string, init: { body: string }) => {
      calls.push({ url: u, body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ ok: true, result: [{ update_id: 3 }] }), { status: 200 })
    }) as unknown as typeof fetch)
    await ok.sendMessage('42', 'halo')
    expect(await ok.getUpdates(7, 25)).toEqual([{ update_id: 3 }])
    expect(calls[0]!.url).toContain('/botSECRET-TOKEN/sendMessage')
    expect(calls[1]).toMatchObject({ body: { offset: 7, timeout: 25, allowed_updates: ['message'] } })

    const bad = new TelegramApi('SECRET-TOKEN', (async () => new Response('x', { status: 403 })) as unknown as typeof fetch)
    const err = await bad.sendMessage('42', 'x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TelegramError)
    expect((err as TelegramError).status).toBe(403)
    expect((err as Error).message).not.toContain('SECRET-TOKEN')
  })
})
