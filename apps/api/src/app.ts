import cors from '@fastify/cors'
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm'
import Fastify, { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { apiKeys, askCreditUses, askPayments, burns, ponsTokens, postQueue, predictions, proAlerts, type createDb } from '@nexa-ai/db'
import {
  alertEventSchema,
  proPlanResponseSchema,
  proSubscribeRequestSchema,
  proSubscribeResponseSchema,
  telegramLinkResponseSchema,
  askRequestSchema,
  askResponseSchema,
  meResponseSchema,
  nonceResponseSchema,
  sessionResponseSchema,
  verifyRequestSchema,
  burnResponseSchema,
  leaderboardResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
  type AskResponse,
  type BurnResponse,
  type LeaderboardResponse,
  type Prediction,
  type ProofResponse,
  type RugRadarResponse,
  type SignalsResponse,
} from '@nexa-ai/api-client'
import { buildMe, createNonce, endSession, monthKey, sessionFrom, verifyLogin, type AuthConfig } from './auth'
import { kolStats, rankEntries } from './leaderboard'
import { buildRiskReport, verifyUsdgPayment, type AskConfig } from './ask'
import { formatBps, formatUnits, formatWinRate, shortAddress } from './format'
import { createLinkCode, proStatus, subscribe, unlinkTelegram, type ProConfig } from './pro'

export type Db = ReturnType<typeof createDb>['db']

export interface AppConfig {
  db: Db
  /** Basis Blockscout, tanpa slash akhir (mis. https://explorer.testnet.chain.robinhood.com). */
  explorerUrl: string
  /** Asal web yang diizinkan CORS (env WEB_ORIGIN; beberapa asal dipisah koma). Kosong = CORS dimatikan. */
  webOrigin?: string
  /** alamat aset (huruf kecil) -> simbol, untuk prediksi yang sudah di-reveal. */
  symbols?: Record<string, string>
  /** Fitur berbayar (Signals API dst.) mati sampai true (env PAID_FEATURES_ENABLED). */
  paidFeaturesEnabled?: boolean
  /** Batas permintaan per kunci API per menit. */
  signalsRateLimitPerMinute?: number
  /** Call ternilai minimum agar masuk peringkat leaderboard (env LEADERBOARD_MIN_SCORED). */
  leaderboardMinScored?: number
  /** Ask NEXA: pembayaran USDG on-chain. Tanpa ini POST /ask menjawab 503. */
  ask?: AskConfig
  /** Login wallet (SIWE) dan benefit holder. Tanpa ini /auth/* dan /me menjawab 503. */
  auth?: AuthConfig
  /** NEXA Pro (langganan USDG, alert stream, Telegram). Tanpa ini /pro/* dan /alerts/stream menjawab 503. */
  pro?: ProConfig
  now?: () => Date
}

type PredictionRow = typeof predictions.$inferSelect
const DAY_MS = 86_400_000
const RECENT_LIMIT = 10
const RADAR_LIMIT = 50

/** Hanya prediksi yang sudah ter-commit on-chain yang pernah terlihat publik; draft tidak. */
const PUBLIC_STATUSES = ['committed', 'posted', 'revealed'] as const

export function buildApp(cfg: AppConfig): FastifyInstance {
  const app = Fastify({ logger: false })
  const now = () => (cfg.now ? cfg.now() : new Date())
  const symbols = cfg.symbols ?? {}
  const tx = (hash: string) => `${cfg.explorerUrl}/tx/${hash}`

  if (cfg.webOrigin) void app.register(cors, { origin: cfg.webOrigin.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean), methods: ['GET', 'POST'], allowedHeaders: ['content-type', 'x-api-key', 'authorization', 'last-event-id'] })

  function toPrediction(row: PredictionRow): Prediction {
    const committedAt = row.committedAt!
    const maturesAt = row.maturesAt!
    const revealed =
      row.status === 'revealed' && row.revealedText !== null && row.revealedAsset !== null && row.revealedDirection !== null && row.won !== null && row.returnBps !== null && row.revealTxHash
        ? (() => {
            const aligned = alignedBps(row)!
            return {
              text: row.revealedText,
              assetSymbol: symbols[row.revealedAsset.toLowerCase()] ?? shortAddress(row.revealedAsset),
              direction: row.revealedDirection === 1 ? ('up' as const) : ('down' as const),
              won: row.won,
              returnBps: aligned,
              returnFormatted: formatBps(aligned),
              revealTxHash: row.revealTxHash,
              revealTxUrl: tx(row.revealTxHash),
            }
          })()
        : null
    return {
      id: row.ledgerId!,
      status: row.status as 'committed' | 'posted' | 'revealed',
      hash: row.hash,
      commitTxHash: row.commitTxHash!,
      commitTxUrl: tx(row.commitTxHash!),
      committedAt: committedAt.toISOString(),
      maturesAt: maturesAt.toISOString(),
      horizonDays: Math.max(1, Math.round((maturesAt.getTime() - committedAt.getTime()) / DAY_MS)),
      revealed,
    }
  }

  /** Return searah klaim: prediksi turun yang benar bernilai positif (sama dengan sumReturnBps di kontrak). */
  function alignedBps(row: PredictionRow): number | null {
    if (row.returnBps === null || row.revealedDirection === null) return null
    return row.revealedDirection === 1 ? row.returnBps : -row.returnBps
  }

  const publicRows = (db: Db) =>
    db
      .select()
      .from(predictions)
      .where(and(inArray(predictions.status, [...PUBLIC_STATUSES]), isNotNull(predictions.ledgerId), isNotNull(predictions.commitTxHash)))
      .orderBy(desc(predictions.committedAt))

  const cache = (reply: { header: (k: string, v: string) => unknown }) => reply.header('cache-control', 'public, max-age=15')

  app.get('/healthz', async () => ({ ok: true }))

  app.get('/proof', async (_req, reply) => {
    const rows = await publicRows(cfg.db)
    const scoredRows = rows.filter((r) => r.status === 'revealed' && alignedBps(r) !== null)
    const open = rows.filter((r) => r.status !== 'revealed')
    const wins = scoredRows.filter((r) => r.won === true).length
    const scored = scoredRows.length
    const winRate = scored > 0 ? wins / scored : null
    const avgReturnBps = scored > 0 ? Math.round(scoredRows.reduce((a, r) => a + alignedBps(r)!, 0) / scored) : null

    const cur = open[0]
    const current = cur
      ? {
          day: Math.min(
            Math.max(1, Math.floor((now().getTime() - cur.committedAt!.getTime()) / DAY_MS) + 1),
            Math.max(1, Math.round((cur.maturesAt!.getTime() - cur.committedAt!.getTime()) / DAY_MS)),
          ),
          prediction: toPrediction(cur),
        }
      : null

    const body: ProofResponse = proofResponseSchema.parse({
      stats: { scored, wins, pending: open.length, winRate, avgReturnBps },
      formatted: {
        winRate: winRate === null ? null : formatWinRate(winRate),
        avgReturn: avgReturnBps === null ? null : formatBps(avgReturnBps),
      },
      current,
      recent: rows.slice(0, RECENT_LIMIT).map(toPrediction),
    })
    cache(reply)
    return body
  })

  app.get('/predictions/:id', async (req, reply) => {
    const parsed = z.object({ id: z.coerce.number().int().nonnegative() }).safeParse(req.params)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const [row] = await publicRows(cfg.db).then((rs) => rs.filter((r) => r.ledgerId === parsed.data.id))
    if (!row) return reply.code(404).send({ error: 'not_found' })
    cache(reply)
    return predictionResponseSchema.parse(toPrediction(row))
  })

  app.get('/rug-radar', async (_req, reply) => {
    const rows = await cfg.db.select().from(ponsTokens).orderBy(desc(ponsTokens.launchedAt)).limit(RADAR_LIMIT)
    const t = now()
    const body: RugRadarResponse = rugRadarResponseSchema.parse({
      updatedAt: t.toISOString(),
      items: rows.map((r) => ({
        token: r.address,
        name: r.name,
        symbol: r.symbol,
        launchedAt: r.launchedAt.toISOString(),
        ageSeconds: Math.max(0, Math.floor((t.getTime() - r.launchedAt.getTime()) / 1000)),
        graduated: r.graduatedAt !== null,
        creatorTaxBps: r.creatorTaxBps,
        topHolderShareBps: r.topHolderShareBps,
        redFlags: r.redFlags,
        explorerUrl: `${cfg.explorerUrl}/address/${r.address}`,
      })),
    })
    cache(reply)
    return body
  })

  // NEXA vs KOL: leaderboard akurasi. Hanya KOL yang opted_in; baris NEXA dihitung dari /proof yang sama.
  app.get('/leaderboard', async (_req, reply) => {
    const rows = await publicRows(cfg.db)
    const scoredRows = rows.filter((r) => r.status === 'revealed' && alignedBps(r) !== null)
    const nexa = {
      handle: 'nexa',
      displayName: 'NEXA',
      isNexa: true,
      scored: scoredRows.length,
      wins: scoredRows.filter((r) => r.won === true).length,
      pending: rows.filter((r) => r.status !== 'revealed').length,
      avgReturnBps: scoredRows.length ? Math.round(scoredRows.reduce((a, r) => a + alignedBps(r)!, 0) / scoredRows.length) : null,
    }
    const minScored = cfg.leaderboardMinScored ?? 3
    const body: LeaderboardResponse = leaderboardResponseSchema.parse({
      updatedAt: now().toISOString(),
      minScored,
      entries: rankEntries([nexa, ...(await kolStats(cfg.db))], minScored),
    })
    cache(reply)
    return body
  })

  // Burn tracker: event `Burned` BurnVault. $NEXA 18 desimal. Kosong sampai BurnVault ada dan ter-index.
  const NEXA_DECIMALS = 18
  const units = (raw: bigint) => ({ raw: raw.toString(), decimals: NEXA_DECIMALS, formatted: formatUnits(raw, NEXA_DECIMALS) })
  app.get('/burn', async (_req, reply) => {
    const rows = await cfg.db.select().from(burns).orderBy(desc(burns.at))
    const total = rows.reduce((a, r) => a + BigInt(r.nexaBurned), 0n)
    const body: BurnResponse = burnResponseSchema.parse({
      totalBurned: units(total),
      burns: rows.slice(0, RECENT_LIMIT).map((r) => ({
        at: r.at.toISOString(),
        amount: units(BigInt(r.nexaBurned)),
        txHash: r.txHash,
        txUrl: tx(r.txHash),
      })),
    })
    cache(reply)
    return body
  })

  // Signals API: berbayar, jadi mati sampai PAID_FEATURES_ENABLED=true; butuh kunci API + batas laju.
  const rateWindow = new Map<number, { start: number; count: number }>()
  const rateLimit = cfg.signalsRateLimitPerMinute ?? 60
  app.get('/signals', async (req, reply) => {
    if (!cfg.paidFeaturesEnabled) return reply.code(503).send({ error: 'paid_features_disabled' })
    const key = req.headers['x-api-key']
    if (typeof key !== 'string' || key.length === 0) return reply.code(401).send({ error: 'api_key_required' })
    const keyHash = createHash('sha256').update(key).digest('hex')
    const [row] = await cfg.db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    if (!row) return reply.code(401).send({ error: 'invalid_api_key' })

    const t = now().getTime()
    const w = rateWindow.get(row.id)
    if (!w || t - w.start >= 60_000) rateWindow.set(row.id, { start: t, count: 1 })
    else if (++w.count > rateLimit) {
      void reply.header('retry-after', String(Math.max(1, Math.ceil((w.start + 60_000 - t) / 1000))))
      return reply.code(429).send({ error: 'rate_limited' })
    }

    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query)
    if (!q.success) return reply.code(400).send({ error: 'invalid_query' })
    const rows = await cfg.db
      .select({ post: postQueue, ledgerId: predictions.ledgerId })
      .from(postQueue)
      .leftJoin(predictions, eq(postQueue.predictionId, predictions.id))
      .where(and(eq(postQueue.status, 'posted'), isNotNull(postQueue.postedAt)))
      .orderBy(desc(postQueue.postedAt))
      .limit(q.data.limit)
    const body: SignalsResponse = signalsResponseSchema.parse({
      items: rows.map((r) => ({
        id: r.post.id,
        kind: r.post.kind,
        content: r.post.content,
        postedAt: r.post.postedAt!.toISOString(),
        ledgerId: r.ledgerId,
      })),
    })
    void reply.header('cache-control', 'private, no-store')
    return body
  })

  // Login wallet (SIWE): nonce -> tanda tangan di wallet -> sesi bearer. Di belakang flag fitur berbayar.
  const auth = cfg.auth
  const authOn = () => Boolean(cfg.paidFeaturesEnabled && auth)

  app.get('/auth/nonce', async (_req, reply) => {
    if (!authOn()) return reply.code(503).send({ error: 'paid_features_disabled' })
    void reply.header('cache-control', 'no-store')
    return nonceResponseSchema.parse(await createNonce(cfg.db, auth!, now()))
  })

  app.post('/auth/verify', async (req, reply) => {
    if (!authOn()) return reply.code(503).send({ error: 'paid_features_disabled' })
    const parsed = verifyRequestSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const r = await verifyLogin(cfg.db, auth!, parsed.data, now())
    if (!r.ok) return reply.code(401).send({ error: r.reason })
    void reply.header('cache-control', 'no-store')
    return sessionResponseSchema.parse({ token: r.token, address: r.address, expiresAt: r.expiresAt })
  })

  app.post('/auth/logout', async (req, reply) => {
    if (!authOn()) return reply.code(503).send({ error: 'paid_features_disabled' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (s) await endSession(cfg.db, s.tokenHash)
    return reply.code(204).send()
  })

  app.get('/me', async (req, reply) => {
    if (!authOn()) return reply.code(503).send({ error: 'paid_features_disabled' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (!s) return reply.code(401).send({ error: 'login_required' })
    void reply.header('cache-control', 'private, no-store')
    return meResponseSchema.parse(await buildMe(cfg.db, auth!, s.address, now()))
  })

  // ---- NEXA Pro ($19/bulan): langganan USDG on-chain, alert real-time (SSE) dan Telegram. Di belakang flag fitur berbayar.
  const pro = cfg.pro
  const proOn = () => Boolean(cfg.paidFeaturesEnabled && pro)
  const price = () => ({ raw: pro!.payment.minAmount.toString(), decimals: 6, formatted: formatUnits(pro!.payment.minAmount, 6) })

  app.get('/pro/plan', async (_req, reply) => {
    if (!proOn()) return reply.code(503).send({ error: 'paid_features_disabled' })
    cache(reply)
    return proPlanResponseSchema.parse({
      price: price(),
      durationDays: pro!.days,
      recipient: pro!.payment.recipient,
      usdgAddress: pro!.payment.usdg,
      chainId: pro!.chainId,
      telegramBot: pro!.telegramBot ?? null,
    })
  })

  app.post('/pro/subscribe', async (req, reply) => {
    if (!proOn() || !auth) return reply.code(503).send({ error: 'paid_features_disabled' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (!s) return reply.code(401).send({ error: 'login_required' })
    const parsed = proSubscribeRequestSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const r = await subscribe(cfg.db, pro!, s.address, parsed.data.txHash, now())
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    void reply.header('cache-control', 'private, no-store')
    return proSubscribeResponseSchema.parse({ active: true, expiresAt: r.expiresAt.toISOString(), addedDays: r.addedDays, paymentTxUrl: tx(parsed.data.txHash) })
  })

  app.post('/pro/telegram/link', async (req, reply) => {
    if (!proOn() || !auth) return reply.code(503).send({ error: 'paid_features_disabled' })
    if (!pro!.telegramBot) return reply.code(503).send({ error: 'telegram_not_configured' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (!s) return reply.code(401).send({ error: 'login_required' })
    if (!(await proStatus(cfg.db, s.address, now())).active) return reply.code(402).send({ error: 'subscription_required' })
    const { code, expiresAt } = await createLinkCode(cfg.db, s.address, now())
    void reply.header('cache-control', 'private, no-store')
    return telegramLinkResponseSchema.parse({ code, url: `https://t.me/${pro!.telegramBot}?start=${code}`, expiresAt: expiresAt.toISOString() })
  })

  app.post('/pro/telegram/unlink', async (req, reply) => {
    if (!proOn() || !auth) return reply.code(503).send({ error: 'paid_features_disabled' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (!s) return reply.code(401).send({ error: 'login_required' })
    await unlinkTelegram(cfg.db, s.address)
    return reply.code(204).send()
  })

  // Stream alert (SSE). Alert dibuat saat post disetujui, 15 menit sebelum post publik di X.
  // Tanpa Last-Event-ID, stream dimulai dari alert terbaru saat ini (hanya yang baru); dengan itu, melanjutkan dari id tersebut.
  let shuttingDown = false
  // preClose (bukan onClose): server menunggu koneksi terbuka selesai, jadi stream harus diberi tahu lebih dulu.
  app.addHook('preClose', async () => {
    shuttingDown = true
  })
  app.get('/alerts/stream', async (req, reply) => {
    if (!proOn() || !auth) return reply.code(503).send({ error: 'paid_features_disabled' })
    const s = await sessionFrom(cfg.db, req.headers.authorization, now())
    if (!s) return reply.code(401).send({ error: 'login_required' })
    if (!(await proStatus(cfg.db, s.address, now())).active) return reply.code(402).send({ error: 'subscription_required' })

    const header = Number(req.headers['last-event-id'])
    let last = Number.isInteger(header) && header >= 0 ? header : ((await cfg.db.select({ id: proAlerts.id }).from(proAlerts).orderBy(desc(proAlerts.id)).limit(1))[0]?.id ?? 0)

    const pollMs = pro!.alertPollMs ?? 3000
    const heartbeatMs = pro!.heartbeatMs ?? 15_000
    const raw = reply.raw
    void reply.hijack()
    // Header CORS yang sudah diset plugin ikut dibawa; hijack melewati penulisan header normal.
    raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    raw.write('retry: 5000\n: connected\n\n')

    let closed = false
    let wake: (() => void) | null = null
    raw.on('close', () => {
      closed = true
      wake?.()
    })
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms)
        wake = () => {
          clearTimeout(t)
          resolve()
        }
      })

    let lastWrite = Date.now()
    let lastCheck = Date.now()
    try {
      while (!closed && !shuttingDown) {
        const rows = await cfg.db.select().from(proAlerts).where(gt(proAlerts.id, last)).orderBy(asc(proAlerts.id)).limit(50)
        for (const r of rows) {
          const ev = alertEventSchema.parse({ id: r.id, kind: r.kind, content: r.content, createdAt: r.createdAt.toISOString(), publicAt: r.publicAt ? r.publicAt.toISOString() : null })
          raw.write(`id: ${r.id}\nevent: alert\ndata: ${JSON.stringify(ev)}\n\n`)
          last = r.id
          lastWrite = Date.now()
        }
        if (Date.now() - lastWrite >= heartbeatMs) {
          raw.write(': ping\n\n')
          lastWrite = Date.now()
        }
        // Langganan atau sesi berakhir: tutup stream (klien akan melihat 402/401 saat tersambung ulang).
        if (Date.now() - lastCheck >= 30_000) {
          lastCheck = Date.now()
          if (!(await sessionFrom(cfg.db, req.headers.authorization, now())) || !(await proStatus(cfg.db, s.address, now())).active) break
        }
        if (rows.length < 50) await sleep(pollMs)
      }
    } catch {
      /* koneksi putus atau DB gagal sesaat: tutup, klien menyambung ulang dengan Last-Event-ID */
    } finally {
      raw.end()
    }
  })

  // Ask NEXA: $1 USDG per laporan, atau kredit gratis bulanan holder $NEXA (butuh sesi login).
  // Pembayaran diverifikasi on-chain SEBELUM analisis dijalankan.
  app.post('/ask', async (req, reply) => {
    if (!cfg.paidFeaturesEnabled || !cfg.ask) return reply.code(503).send({ error: 'paid_features_disabled' })
    const parsed = askRequestSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const { address, txHash } = parsed.data

    let payer: string
    let amount = 0n
    if (txHash) {
      const [used] = await cfg.db.select().from(askPayments).where(eq(askPayments.txHash, txHash.toLowerCase()))
      if (used) return reply.code(409).send({ error: 'payment_already_used' })
      const pay = await verifyUsdgPayment(cfg.ask, txHash as `0x${string}`)
      if (!pay.ok) return reply.code(402).send({ error: pay.reason })
      payer = pay.payer
      amount = pay.amount
    } else {
      // Kredit gratis: hanya holder yang login dan masih punya kredit bulan ini.
      const s = auth ? await sessionFrom(cfg.db, req.headers.authorization, now()) : null
      if (!s) return reply.code(401).send({ error: 'login_required' })
      const me = await buildMe(cfg.db, auth!, s.address, now())
      if (!me.holder.isHolder) return reply.code(403).send({ error: 'not_a_holder' })
      if (me.benefits.freeAsksRemaining <= 0) return reply.code(402).send({ error: 'no_free_credits' })
      payer = s.address
    }

    // Token terlalu baru atau tanpa data: tidak dibahas dan pembayaran/kredit TIDAK dihabiskan.
    const result = await buildRiskReport(cfg.db, address, now())
    if (result.kind !== 'report') return reply.code(422).send({ error: result.kind === 'too_new' ? 'token_too_new' : 'no_data' })

    if (txHash) {
      const claimed = await cfg.db
        .insert(askPayments)
        .values({ txHash: txHash.toLowerCase(), payer, amount: amount.toString(), askedAddress: address.toLowerCase() })
        .onConflictDoNothing()
        .returning({ txHash: askPayments.txHash })
      if (claimed.length === 0) return reply.code(409).send({ error: 'payment_already_used' })
    } else {
      await cfg.db.insert(askCreditUses).values({ address: payer, month: monthKey(now()), askedAddress: address.toLowerCase() })
    }

    const body: AskResponse = askResponseSchema.parse({
      address,
      generatedAt: now().toISOString(),
      report: result.report,
      paymentTxUrl: txHash ? tx(txHash) : null,
    })
    void reply.header('cache-control', 'private, no-store')
    return body
  })

  return app
}
