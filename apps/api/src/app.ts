import cors from '@fastify/cors'
import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import Fastify, { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { apiKeys, burns, ponsTokens, postQueue, predictions, type createDb } from '@nexa-ai/db'
import {
  burnResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
  type BurnResponse,
  type Prediction,
  type ProofResponse,
  type RugRadarResponse,
  type SignalsResponse,
} from '@nexa-ai/api-client'
import { formatBps, formatUnits, formatWinRate, shortAddress } from './format'

export type Db = ReturnType<typeof createDb>['db']

export interface AppConfig {
  db: Db
  /** Basis Blockscout, tanpa slash akhir (mis. https://explorer.testnet.chain.robinhood.com). */
  explorerUrl: string
  /** Asal web yang diizinkan CORS (env WEB_ORIGIN). Kosong = CORS dimatikan. */
  webOrigin?: string
  /** alamat aset (huruf kecil) -> simbol, untuk prediksi yang sudah di-reveal. */
  symbols?: Record<string, string>
  /** Fitur berbayar (Signals API dst.) mati sampai true (env PAID_FEATURES_ENABLED). */
  paidFeaturesEnabled?: boolean
  /** Batas permintaan per kunci API per menit. */
  signalsRateLimitPerMinute?: number
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

  if (cfg.webOrigin) void app.register(cors, { origin: cfg.webOrigin, methods: ['GET'] })

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

  return app
}
