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
