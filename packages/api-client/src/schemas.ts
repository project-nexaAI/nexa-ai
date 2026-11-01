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
  /** Tx pembayaran USDG ke penerima Ask NEXA. Dihilangkan bila memakai kredit gratis holder (butuh sesi login). */
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
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
  /** Null bila laporan memakai kredit gratis holder. */
  paymentTxUrl: z.string().url().nullable(),
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

// ------------------------------------------------------------- login wallet (SIWE)

export const nonceResponseSchema = z.object({ nonce: z.string().min(8), expiresAt: iso })
export type NonceResponse = z.infer<typeof nonceResponseSchema>

export const verifyRequestSchema = z.object({ message: z.string().min(1).max(4000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) })
export type VerifyRequest = z.infer<typeof verifyRequestSchema>

export const sessionResponseSchema = z.object({
  /** Token bearer; simpan di sessionStorage, kirim lewat header Authorization. */
  token: z.string(),
  address: z.string(),
  expiresAt: iso,
})
export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const meResponseSchema = z.object({
  address: z.string(),
  holder: z.object({
    /** false bila benefit holder belum dikonfigurasi (token $NEXA belum ada atau HOLDER_THRESHOLD kosong). */
    enabled: z.boolean(),
    isHolder: z.boolean(),
    balance: z.object({ raw: z.string().regex(/^\d+$/), decimals: z.number().int(), formatted: z.string() }).nullable(),
    threshold: z.object({ raw: z.string().regex(/^\d+$/), decimals: z.number().int(), formatted: z.string() }).nullable(),
  }),
  benefits: z.object({
    /** Alert Pro lebih cepat (dipakai alert stream saat tersedia). */
    earlyAlerts: z.boolean(),
    freeAsksPerMonth: z.number().int().nonnegative(),
    freeAsksRemaining: z.number().int().nonnegative(),
    /** Bulan UTC kredit berlaku, `YYYY-MM`. */
    month: z.string(),
  }),
  /** Langganan NEXA Pro milik alamat ini. */
  pro: z.object({
    active: z.boolean(),
    /** Akhir masa aktif; null bila belum pernah berlangganan. Tetap terisi setelah kedaluwarsa. */
    expiresAt: iso.nullable(),
    /** Chat Telegram pribadi sudah ditautkan untuk menerima alert. */
    telegramLinked: z.boolean(),
  }),
})
export type MeResponse = z.infer<typeof meResponseSchema>

// ------------------------------------------------------------- NEXA Pro

const unitAmount = z.object({ raw: z.string().regex(/^\d+$/), decimals: z.number().int(), formatted: z.string() })

export const proPlanResponseSchema = z.object({
  /** Harga per periode dalam USDG (6 desimal), nilai mentah dan terformat. */
  price: unitAmount,
  durationDays: z.number().int().positive(),
  /** Kirim USDG ke alamat ini di chain `chainId`, lalu kirim tx hash ke POST /pro/subscribe. */
  recipient: z.string(),
  usdgAddress: z.string(),
  chainId: z.number().int().positive(),
  /** Username bot Telegram (tanpa @) untuk alert; null bila Telegram belum dikonfigurasi. */
  telegramBot: z.string().nullable(),
})
export type ProPlanResponse = z.infer<typeof proPlanResponseSchema>

export const proSubscribeRequestSchema = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) })
export type ProSubscribeRequest = z.infer<typeof proSubscribeRequestSchema>

export const proSubscribeResponseSchema = z.object({
  active: z.boolean(),
  expiresAt: iso,
  addedDays: z.number().int().positive(),
  paymentTxUrl: z.string().url(),
})
export type ProSubscribeResponse = z.infer<typeof proSubscribeResponseSchema>

export const telegramLinkResponseSchema = z.object({
  /** Kode sekali pakai; kirim `/start <kode>` ke bot (atau buka `url`). Berlaku singkat. */
  code: z.string(),
  url: z.string().url(),
  expiresAt: iso,
})
export type TelegramLinkResponse = z.infer<typeof telegramLinkResponseSchema>

/** Satu alert di stream SSE `GET /alerts/stream` (event `alert`, data = JSON ini). */
export const alertEventSchema = z.object({
  id: z.number().int().positive(),
  kind: z.string(),
  content: z.string(),
  createdAt: iso,
  /** Jadwal post publik di X (15 menit setelah alert). */
  publicAt: iso.nullable(),
})
export type AlertEvent = z.infer<typeof alertEventSchema>

// ------------------------------------------------------------- Signals: transfer whale

export const signalsWhalesResponseSchema = z.object({
  /** Transfer Stock Token besar yang tercatat indexer, terbaru dulu. */
  items: z.array(
    z.object({
      /** `${txHash}-${logIndex}` */
      id: z.string(),
      token: z.string(),
      /** Simbol bila token dikenal (mis. NVDA); selain itu null. */
      symbol: z.string().nullable(),
      from: z.string(),
      to: z.string(),
      amount: unitAmount,
      at: iso,
      txHash: hex,
      txUrl: z.string().url(),
    }),
  ),
})
export type SignalsWhalesResponse = z.infer<typeof signalsWhalesResponseSchema>
