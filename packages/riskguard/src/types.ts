import { z } from 'zod'

export const CONTENT_TYPES = [
  'daily_summary',
  'prediction',
  'mention_reply',
  'risk_report',
  'technical_announcement',
  'burn_report',
  'sponsored',
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

/** Kode alasan stabil: dipakai log, test, dan CLI persetujuan. */
export const REASON = {
  ADVICE_PHRASE: 'ADVICE_PHRASE',
  PRICE_TARGET: 'PRICE_TARGET',
  NEXA_MENTION: 'NEXA_MENTION',
  NEXA_PRICE: 'NEXA_PRICE',
  SPONSORED_LABEL: 'SPONSORED_LABEL',
  TOKEN_TOO_NEW: 'TOKEN_TOO_NEW',
  TOKEN_AGE_UNKNOWN: 'TOKEN_AGE_UNKNOWN',
  UNTRACKED_ADDRESS: 'UNTRACKED_ADDRESS',
  DATA_INCOMPLETE: 'DATA_INCOMPLETE',
  URL: 'URL',
  MISSING_DISCLAIMER: 'MISSING_DISCLAIMER',
  NUMBER_UNTRACED: 'NUMBER_UNTRACED',
} as const
export type ReasonCode = (typeof REASON)[keyof typeof REASON]

export const riskGuardInputSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  text: z.string(),
  /**
   * Token yang dibahas, dari tool result indexer. `ageSeconds` null = umur tidak diketahui.
   * Setiap alamat 0x di teks wajib ada di daftar ini.
   */
  tokens: z
    .array(z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/), ageSeconds: z.number().int().nonnegative().nullable() }))
    .default([]),
  /** false jika tool result kosong/gagal. Default false: tanpa bukti data lengkap, jawab "tidak tahu". */
  dataComplete: z.boolean().default(false),
  /**
   * Fakta dari tool result (mis. "142.10", "35 bps", "0.35%", "7"). Jika diberikan, setiap angka di teks harus
   * ada di sini (aturan pipeline 3: setiap angka dapat dilacak ke tool result). Tidak diberikan = aturan dilewati.
   */
  facts: z.array(z.string()).optional(),
})
export type RiskGuardInput = z.input<typeof riskGuardInputSchema>

export interface RiskGuardConfig {
  /** 'all' = semua post masuk antrian persetujuan (30 hari pertama); 'risky' = hanya yang berisiko. */
  approvalMode: 'all' | 'risky'
  /** Umur minimum token yang boleh dibahas (detik). Brief: 1 jam. */
  minTokenAgeSeconds: number
}

export const DEFAULT_CONFIG: RiskGuardConfig = { approvalMode: 'all', minTokenAgeSeconds: 3600 }

export interface RiskGuardDecision {
  allowed: boolean
  reasons: ReasonCode[]
  requiresApproval: boolean
}

export interface DecisionLogEntry {
  contentType: ContentType
  contentHash: string
  allowed: boolean
  reasons: ReasonCode[]
  requiresApproval: boolean
}
