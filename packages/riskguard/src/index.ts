import { createHash } from 'node:crypto'
import { runRules } from './rules'
import {
  DEFAULT_CONFIG,
  riskGuardInputSchema,
  type DecisionLogEntry,
  type RiskGuardConfig,
  type RiskGuardDecision,
  type RiskGuardInput,
} from './types'

export * from './types'
export { mentionsNexaToken, isUnknownReply } from './rules'

const ALWAYS_REVIEW = new Set(['sponsored', 'mention_reply', 'risk_report'])

/**
 * Filter konten berbasis kode (bukan AI). Tidak ada post yang keluar tanpa `allowed: true`.
 * Input divalidasi zod; input tidak valid ditolak (fail closed).
 */
export function evaluate(rawInput: RiskGuardInput, config: Partial<RiskGuardConfig> = {}): RiskGuardDecision {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const parsed = riskGuardInputSchema.safeParse(rawInput)
  if (!parsed.success) return { allowed: false, reasons: ['DATA_INCOMPLETE'], requiresApproval: true }
  const input = parsed.data

  const reasons = runRules({
    type: input.type,
    text: input.text,
    tokens: input.tokens,
    dataComplete: input.dataComplete,
    minTokenAgeSeconds: cfg.minTokenAgeSeconds,
    facts: input.facts,
  })
  const allowed = reasons.length === 0
  const requiresApproval = !allowed || cfg.approvalMode === 'all' || ALWAYS_REVIEW.has(input.type)
  return { allowed, reasons, requiresApproval }
}

/** Entri log keputusan. Hanya hash konten yang disimpan, bukan teks. */
export function toLogEntry(input: RiskGuardInput, decision: RiskGuardDecision): DecisionLogEntry {
  return {
    contentType: input.type,
    contentHash: createHash('sha256').update(input.text).digest('hex'),
    allowed: decision.allowed,
    reasons: decision.reasons,
    requiresApproval: decision.requiresApproval,
  }
}
