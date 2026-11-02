import { createHmac, randomBytes } from 'node:crypto'
import { z } from 'zod'

/** Klien X untuk posting dan reply saja (follow, like, quote hanya ada di Enterprise; brief). */
export interface XClient {
  post(text: string, opts?: { replyTo?: string }): Promise<{ id: string }>
}

export interface XCredentials {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

export class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** true = galat sementara (batas laju, gangguan X); post boleh dicoba lagi. */
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

const TWEETS_URL = 'https://api.x.com/2/tweets'
const createdSchema = z.object({ data: z.object({ id: z.string().regex(/^\d+$/), text: z.string().optional() }) })

// Encoding RFC 3986 yang dipakai tanda tangan OAuth 1.0a.
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/**
 * Header Authorization OAuth 1.0a (HMAC-SHA1, user context). Body JSON tidak ikut dalam tanda tangan.
 * Kunci tidak pernah dicatat; hanya header yang dikirim ke X.
 */
export function oauthHeader(method: string, url: string, c: XCredentials, nonce = randomBytes(16).toString('hex'), timestamp = Math.floor(Date.now() / 1000)): string {
  const params: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  }
  const normalized = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k]!)}`)
    .join('&')
  const base = [method.toUpperCase(), enc(url), enc(normalized)].join('&')
  const signature = createHmac('sha1', `${enc(c.apiSecret)}&${enc(c.accessSecret)}`).update(base).digest('base64')
  const header = { ...params, oauth_signature: signature }
  return 'OAuth ' + Object.keys(header).sort().map((k) => `${enc(k)}="${enc(header[k as keyof typeof header]!)}"`).join(', ')
}

const ME_URL = 'https://api.x.com/2/users/me'
const meSchema = z.object({ data: z.object({ id: z.string(), username: z.string() }) })

/**
 * Cek kunci tanpa memposting: GET /2/users/me dengan user context. Mengembalikan akun pemilik token.
 * Satu permintaan baca (sekitar $0,005 per brief). Galat dari X dibawa apa adanya; kunci tidak pernah ikut.
 */
export async function verifyCredentials(creds: XCredentials, fetchFn: typeof fetch = fetch): Promise<{ id: string; username: string }> {
  let res: Response
  try {
    res = await fetchFn(ME_URL, { method: 'GET', headers: { authorization: oauthHeader('GET', ME_URL, creds) } })
  } catch {
    throw new XApiError('X tidak terjangkau', 0, true)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new XApiError(`X menolak kunci (${res.status}): ${detail.slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500)
  }
  const parsed = meSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new XApiError('jawaban X tidak dikenali', res.status, false)
  return parsed.data.data
}

export function createXClient(creds: XCredentials, fetchFn: typeof fetch = fetch): XClient {
  return {
    async post(text, opts = {}) {
      const body = { text, ...(opts.replyTo ? { reply: { in_reply_to_tweet_id: opts.replyTo } } : {}) }
      let res: Response
      try {
        res = await fetchFn(TWEETS_URL, {
          method: 'POST',
          headers: { authorization: oauthHeader('POST', TWEETS_URL, creds), 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        throw new XApiError('X tidak terjangkau', 0, true)
      }
      if (res.status === 429 || res.status >= 500) throw new XApiError(`X menjawab ${res.status}`, res.status, true)
      if (!res.ok) {
        // Isi galat dari X dipakai apa adanya untuk diagnosis; tidak memuat kunci kita.
        const detail = await res.text().catch(() => '')
        throw new XApiError(`X menolak post (${res.status}): ${detail.slice(0, 300)}`, res.status, false)
      }
      const parsed = createdSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) throw new XApiError('jawaban X tidak dikenali', res.status, false)
      return { id: parsed.data.data.id }
    },
  }
}
