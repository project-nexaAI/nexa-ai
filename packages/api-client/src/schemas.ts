import { z } from 'zod'

// Bentuk response API (CLAUDE.md bagian 8): nilai mentah + nilai terformat, plus link Blockscout untuk setiap commit.
// Uang/harga bertipe string desimal (bukan float); waktu ISO 8601 UTC.

const hex = z.string().regex(/^0x[0-9a-fA-F]+$/)
const iso = z.string().datetime()

export const predictionSchema = z.object({
  id: z.number().int().nonnegative(),
  status: z.enum(['committed', 'posted', 'revealed']),
  /** Hash commit; teks/salt tidak dibuka sebelum reveal. */
  hash: hex,
  commitTxHash: hex,
  commitTxUrl: z.string().url(),
  committedAt: iso,
  maturesAt: iso,
  horizonDays: z.number().int().positive(),
  /** Hanya terisi setelah reveal. */
  revealed: z
    .object({
      text: z.string(),
      assetSymbol: z.string(),
      direction: z.enum(['up', 'down']),
      won: z.boolean(),
      returnBps: z.number().int(),
      returnFormatted: z.string(),
      revealTxHash: hex,
      revealTxUrl: z.string().url(),
    })
    .nullable(),
})
export type Prediction = z.infer<typeof predictionSchema>

export const proofResponseSchema = z.object({
  stats: z.object({
    scored: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    /** 0..1; null sampai ada prediksi yang dinilai. */
    winRate: z.number().min(0).max(1).nullable(),
    avgReturnBps: z.number().int().nullable(),
  }),
  formatted: z.object({
    winRate: z.string().nullable(),
    avgReturn: z.string().nullable(),
  }),
  /** Prediction of the Day yang sedang berjalan; `day` 1..horizonDays. */
  current: z.object({ day: z.number().int().min(1), prediction: predictionSchema }).nullable(),
  recent: z.array(predictionSchema),
})
export type ProofResponse = z.infer<typeof proofResponseSchema>

export const predictionResponseSchema = predictionSchema
export type PredictionResponse = Prediction

export const rugRadarResponseSchema = z.object({
  updatedAt: iso,
  items: z.array(
    z.object({
      token: hex,
      name: z.string().nullable(),
      symbol: z.string().nullable(),
      launchedAt: iso,
      ageSeconds: z.number().int().nonnegative(),
      graduated: z.boolean(),
      creatorTaxBps: z.number().int().nullable(),
      topHolderShareBps: z.number().int().nullable(),
      redFlags: z.array(z.string()),
      explorerUrl: z.string().url(),
    }),
  ),
})
export type RugRadarResponse = z.infer<typeof rugRadarResponseSchema>

export const burnResponseSchema = z.object({
  /** Jumlah $NEXA dibakar: mentah (unit terkecil) + desimal + terformat. */
  totalBurned: z.object({ raw: z.string().regex(/^\d+$/), decimals: z.number().int(), formatted: z.string() }),
  burns: z.array(
    z.object({
      at: iso,
      amount: z.object({ raw: z.string().regex(/^\d+$/), decimals: z.number().int(), formatted: z.string() }),
      txHash: hex,
      txUrl: z.string().url(),
    }),
  ),
})
export type BurnResponse = z.infer<typeof burnResponseSchema>

export const signalsResponseSchema = z.object({
  /** Post publik NEXA yang sudah terbit, terbaru dulu. */
  items: z.array(
    z.object({
      id: z.number().int().nonnegative(),
      kind: z.string(),
      content: z.string(),
      postedAt: iso,
      /** Id NexaLedger bila post ini adalah prediksi yang ter-commit; selain itu null. */
      ledgerId: z.number().int().nonnegative().nullable(),
    }),
  ),
})
export type SignalsResponse = z.infer<typeof signalsResponseSchema>

export const askRequestSchema = z.object({
  /** Alamat token yang dianalisis. */
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  /** Tx pembayaran USDG ke penerima Ask NEXA. */
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})
export type AskRequest = z.infer<typeof askRequestSchema>

export const askResponseSchema = z.object({
  address: z.string(),
  generatedAt: iso,
  /** Ringkasan risiko berbasis data indexer saja. Tanpa data = "tidak tahu", bukan tebakan. */
  report: z.object({
    name: z.string().nullable(),
    symbol: z.string().nullable(),
    ageSeconds: z.number().int().nonnegative(),
    graduated: z.boolean(),
    creatorTaxBps: z.number().int().nullable(),
    topHolderShareBps: z.number().int().nullable(),
    trades: z.object({ total: z.number().int().nonnegative(), buys: z.number().int().nonnegative(), sells: z.number().int().nonnegative() }),
    redFlags: z.array(z.string()),
    unknowns: z.array(z.string()),
    disclaimer: z.string(),
  }),
  paymentTxUrl: z.string().url(),
})
export type AskResponse = z.infer<typeof askResponseSchema>

export const leaderboardResponseSchema = z.object({
  updatedAt: iso,
  /** Jumlah call ternilai minimum agar masuk peringkat; di bawahnya rank = null. */
  minScored: z.number().int().nonnegative(),
  entries: z.array(
    z.object({
      rank: z.number().int().positive().nullable(),
      handle: z.string(),
      displayName: z.string(),
      /** true untuk baris NEXA sendiri (dari /proof). */
      isNexa: z.boolean(),
      scored: z.number().int().nonnegative(),
      wins: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
      winRate: z.number().min(0).max(1).nullable(),
      avgReturnBps: z.number().int().nullable(),
      formatted: z.object({ winRate: z.string().nullable(), avgReturn: z.string().nullable() }),
    }),
  ),
})
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>

