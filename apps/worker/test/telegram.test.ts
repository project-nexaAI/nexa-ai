import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, postQueue, riskguardLog } from '@nexa-ai/db'
import { enqueuePost, getPost } from '../src/queue'
import { DryTelegram, TelegramBot, approveAndAlert } from '../src/telegram'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)
let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test telegram dilewati')
}

describe.skipIf(!dbUp)('alert Pro (Telegram dry)', () => {
  beforeEach(async () => {
    await db.delete(postQueue)
    await db.delete(riskguardLog)
  })
  afterAll(async () => {
    await client.end()
  })

  const summary = (text: string) =>
    ({ kind: 'daily_summary', mode: 'dry', input: { type: 'daily_summary', text, dataComplete: true } }) as const

  it('menyetujui lalu mengirim alert dengan isi post', async () => {
    const r = await enqueuePost(db, summary('Selisih DEX vs oracle NVDA 0.4%.'))
    const tg = new DryTelegram()
    await approveAndAlert(db, tg, r.id)
    expect(tg.sent).toEqual(['Selisih DEX vs oracle NVDA 0.4%.'])
    expect((await getPost(db, r.id))?.status).toBe('approved')
  })

  it('post yang diblokir tidak pernah dialert', async () => {
    const r = await enqueuePost(db, summary('Sekarang waktunya beli NVDA'))
    const tg = new DryTelegram()
    await expect(approveAndAlert(db, tg, r.id)).rejects.toThrow()
    expect(tg.sent).toEqual([])
  })
})

describe('TelegramBot', () => {
  it('memanggil Bot API dan tidak membocorkan token di pesan error', async () => {
    const calls: string[] = []
    const ok = new TelegramBot('SECRET-TOKEN', '42', (async (u: string) => {
      calls.push(u)
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch)
    await ok.send('halo')
    expect(calls[0]).toContain('/botSECRET-TOKEN/sendMessage')

    const bad = new TelegramBot('SECRET-TOKEN', '42', (async () => new Response('x', { status: 401 })) as unknown as typeof fetch)
    await expect(bad.send('halo')).rejects.toThrow(/401/)
    await bad.send('x').catch((e: Error) => expect(e.message).not.toContain('SECRET-TOKEN'))
  })
})
