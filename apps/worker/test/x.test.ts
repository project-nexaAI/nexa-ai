import { describe, expect, it } from 'vitest'
import { XApiError, createXClient, oauthHeader, type XCredentials } from '../src/x'

const CREDS: XCredentials = { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessSecret: 'as' }

const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('oauthHeader (OAuth 1.0a)', () => {
  it('memuat parameter wajib, terurut, dan tanda tangan; nilai tetap untuk nonce dan waktu tetap', () => {
    const h = oauthHeader('POST', 'https://api.x.com/2/tweets', CREDS, 'abc123', 1_700_000_000)
    expect(h.startsWith('OAuth ')).toBe(true)
    expect(h).toContain('oauth_consumer_key="ck"')
    expect(h).toContain('oauth_nonce="abc123"')
    expect(h).toContain('oauth_signature_method="HMAC-SHA1"')
    expect(h).toContain('oauth_timestamp="1700000000"')
    expect(h).toContain('oauth_token="at"')
    expect(h).toContain('oauth_version="1.0"')
    expect(h).toMatch(/oauth_signature="[A-Za-z0-9%]+"/)
    expect(oauthHeader('POST', 'https://api.x.com/2/tweets', CREDS, 'abc123', 1_700_000_000)).toBe(h)
  })

  it('tanda tangan berubah bila rahasia, nonce, atau URL berubah; rahasia tidak ikut di header', () => {
    const base = oauthHeader('POST', 'https://api.x.com/2/tweets', CREDS, 'n', 1)
    expect(oauthHeader('POST', 'https://api.x.com/2/tweets', { ...CREDS, accessSecret: 'lain' }, 'n', 1)).not.toBe(base)
    expect(oauthHeader('POST', 'https://api.x.com/2/tweets', CREDS, 'm', 1)).not.toBe(base)
    expect(oauthHeader('POST', 'https://api.x.com/2/lain', CREDS, 'n', 1)).not.toBe(base)
    expect(base).not.toContain('cs')
    expect(base).not.toContain('"as"')
  })
})

describe('createXClient.post', () => {
  it('mengirim teks dan mengembalikan id post', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return reply(201, { data: { id: '1234567890', text: 'halo' } })
    }) as unknown as typeof fetch
    const r = await createXClient(CREDS, fetchFn).post('halo')
    expect(r).toEqual({ id: '1234567890' })
    expect(seen!.url).toBe('https://api.x.com/2/tweets')
    expect(JSON.parse(String(seen!.init.body))).toEqual({ text: 'halo' })
    expect((seen!.init.headers as Record<string, string>).authorization).toMatch(/^OAuth /)
  })

  it('balasan membawa in_reply_to_tweet_id', async () => {
    let body = ''
    const fetchFn = (async (_u: string, init: RequestInit) => {
      body = String(init.body)
      return reply(201, { data: { id: '42' } })
    }) as unknown as typeof fetch
    await createXClient(CREDS, fetchFn).post('jawab', { replyTo: '99' })
    expect(JSON.parse(body)).toEqual({ text: 'jawab', reply: { in_reply_to_tweet_id: '99' } })
  })

  it('429, 5xx, dan jaringan putus = sementara (boleh dicoba lagi)', async () => {
    for (const make of [() => reply(429, {}), () => reply(503, {}), () => Promise.reject(new Error('putus'))]) {
      const fetchFn = (async () => make()) as unknown as typeof fetch
      await expect(createXClient(CREDS, fetchFn).post('x')).rejects.toMatchObject({ retryable: true })
    }
  })

  it('4xx lain = permanen dan isi galat dibawa; kunci tidak ikut di pesan', async () => {
    const fetchFn = (async () => reply(403, { detail: 'You are not allowed to create a Tweet with duplicate content.' })) as unknown as typeof fetch
    const err = await createXClient(CREDS, fetchFn).post('x').catch((e) => e)
    expect(err).toBeInstanceOf(XApiError)
    expect(err.retryable).toBe(false)
    expect(err.status).toBe(403)
    expect(err.message).toContain('duplicate content')
    expect(err.message).not.toContain('cs')
  })

  it('jawaban sukses yang tidak dikenali ditolak', async () => {
    const fetchFn = (async () => reply(200, { aneh: true })) as unknown as typeof fetch
    await expect(createXClient(CREDS, fetchFn).post('x')).rejects.toMatchObject({ retryable: false })
  })
})
