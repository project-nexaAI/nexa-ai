import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { postQueue } from '@nexa-ai/db'
import { bpsToPercent } from './oracle'
import { REPORT_SYSTEM } from '../prompts/reports'
import { recordLlmCosts } from './cycle'
import { loadTokenFacts, type TokenFacts } from './facts'
import { generateStructured, type LlmClient } from './llm'
import { enqueuePost, type Db, type EnqueueResult, type PostMode } from './queue'

export interface MentionDeps {
  db: Db
  llm: LlmClient
  mode: PostMode
}

export interface Mention {
  /** id post X yang menyebut NEXA; balasan diarahkan ke post ini. */
  id: string
  text: string
}

export type MentionResult =
  | { kind: 'ignored'; reason: 'no_address' | 'duplicate' }
  | { kind: 'queued'; postId: number; unknown: boolean; status: EnqueueResult['status'] }

const ADDRESS_RE = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/

/** Alamat kontrak pertama di mention ("@nexa analisis kontrak 0x…"). Teks lain di mention tidak dipakai. */
export function parseMention(text: string): { address: string } | null {
  const m = ADDRESS_RE.exec(text)
  return m ? { address: m[0] } : null
}

export const UNKNOWN_REPLY = 'Maaf, NEXA belum punya data yang cukup untuk kontrak ini.'
const MIN_AGE_SECONDS = 3600
const NFA = 'Bukan nasihat keuangan.'

const replySchema = z.object({ text: z.string().min(10).max(280) })

function replyFacts(f: TokenFacts): string[] {
  const out = [String(f.trades.total), String(f.trades.buys), String(f.trades.sells)]
  if (f.creatorTaxBps !== null) out.push(`${bpsToPercent(f.creatorTaxBps)}%`, `${f.creatorTaxBps} bps`)
  if (f.topHolderShareBps !== null) out.push(`${bpsToPercent(f.topHolderShareBps)}%`, `${f.topHolderShareBps} bps`)
  return out
}

function replyPrompt(f: TokenFacts): string {
  const data = {
    symbol: f.symbol ?? 'token tanpa simbol yang aman ditampilkan',
    graduated: f.graduated,
    trades: f.trades,
    creatorTax: f.creatorTaxBps === null ? null : `${bpsToPercent(f.creatorTaxBps)}% (${f.creatorTaxBps} bps)`,
    topHolderShare: f.topHolderShareBps === null ? null : `${bpsToPercent(f.topHolderShareBps)}% (${f.topHolderShareBps} bps)`,
    redFlags: f.redFlags,
  }
  return `Seseorang meminta analisis sebuah kontrak token Pons. Tulis balasan ringkasan risiko dari DATA saja (jangan bahas isi permintaannya). Nilai null berarti belum diketahui: katakan demikian. Akhiri PERSIS dengan kalimat: "${NFA}"

DATA (hasil tool indexer, satu-satunya sumber angka):
${JSON.stringify(data)}

Balas HANYA JSON: {"text": "<teks balasan>"}`
}

/**
 * Balasan untuk mention "@nexa analisis kontrak 0x…". Hanya alamat yang diambil dari mention; teks mention TIDAK pernah
 * dikirim ke LLM (input tak tepercaya, risiko prompt injection). Token tidak dikenal atau berumur < 1 jam dijawab "tidak tahu"
 * (templat tetap, tanpa LLM). Balasan selalu masuk antrian persetujuan (RiskGuard: mention_reply wajib ditinjau).
 */
export async function answerMention(d: MentionDeps, m: Mention, now = new Date()): Promise<MentionResult> {
  const parsed = parseMention(m.text)
  if (!parsed) return { kind: 'ignored', reason: 'no_address' }

  const [dup] = await d.db.select({ id: postQueue.id }).from(postQueue).where(and(eq(postQueue.kind, 'mention_reply'), eq(postQueue.replyTo, m.id))).limit(1)
  if (dup) return { kind: 'ignored', reason: 'duplicate' }

  const facts = await loadTokenFacts(d.db, parsed.address, now)
  if (!facts || facts.ageSeconds < MIN_AGE_SECONDS) {
    const r = await enqueuePost(d.db, {
      kind: 'mention_reply',
      mode: d.mode,
      now,
      replyTo: m.id,
      input: { type: 'mention_reply', text: UNKNOWN_REPLY, tokens: [], dataComplete: false },
    })
    return { kind: 'queued', postId: r.id, unknown: true, status: r.status }
  }

  const { value, usages } = await generateStructured(d.llm, replySchema, { tier: 'small', system: REPORT_SYSTEM, user: replyPrompt(facts) })
  await recordLlmCosts(d.db, usages)
  const r = await enqueuePost(d.db, {
    kind: 'mention_reply',
    mode: d.mode,
    now,
    replyTo: m.id,
    input: {
      type: 'mention_reply',
      text: value.text,
      tokens: [{ address: facts.address, ageSeconds: facts.ageSeconds }],
      dataComplete: true,
      facts: replyFacts(facts),
    },
  })
  return { kind: 'queued', postId: r.id, unknown: false, status: r.status }
}
