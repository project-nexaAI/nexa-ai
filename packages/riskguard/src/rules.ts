import { baseNormalize, cleanTokens, collapseRepeats, leetVariants, mergeSingleLetterRuns } from './normalize'
import { REASON, type ContentType, type ReasonCode } from './types'

// ------------------------------------------------------------ ajakan beli/jual

// Kata utuh (setelah huruf berulang dikolaps). Sengaja ketat: laporan data memakai kata lain
// ("akumulasi", "distribusi", "transfer masuk/keluar"), bukan beli/jual.
const ADVICE_WORDS = [
  'buy', 'buys', 'buying', 'bought', 'sell', 'sells', 'selling', 'sold',
  'beli', 'membeli', 'dibeli', 'belikan', 'belilah', 'beliin', 'jual', 'menjual', 'dijual', 'jualan', 'jualin', 'jualah',
  'borong', 'memborong', 'serok', 'diserok',
].map(collapseRepeats)
const ADVICE_WORD_RE = new RegExp(`^(?:${ADVICE_WORDS.join('|')})$`)

const ADVICE_PHRASES = [
  'pasti (?:naik|cuan|profit|untung|moon|pump|tembus)',
  'dijamin (?:naik|cuan|profit|untung)',
  'guaranteed?',
  'all in',
  'to the moon',
  'moon soon',
  'ape in',
  'yolo',
  'sure win',
  'cant lose',
  'risk free',
  'free money',
  'wajib (?:masuk|punya|hold)',
  'jangan sampai ketinggalan',
  'dont miss',
  'must have',
  'gas pol',
  'sikat',
].map((p) => new RegExp(`\\b${p.split(' ').map((w) => (w.startsWith('(') ? w : collapseRepeats(w))).join(' ')}\\b`))

function hasAdvicePhrase(base: string): boolean {
  for (const variant of leetVariants(base)) {
    const tokens = cleanTokens(variant)
    const collapsed = tokens.map(collapseRepeats)

    // Kata utuh, termasuk yang dipecah: "b.e.l.i" (sudah satu potongan), "be li", "b u y", "s e l l".
    for (let i = 0; i < collapsed.length; i++) {
      for (let size = 1; size <= 4 && i + size <= collapsed.length; size++) {
        const window = tokens.slice(i, i + size)
        if (size > 1 && window.some((t) => t.length > 4)) continue
        const joined = collapseRepeats(window.join(''))
        if (joined.length > 12) continue
        if (ADVICE_WORD_RE.test(joined)) return true
      }
    }

    const sentence = mergeSingleLetterRuns(tokens).map(collapseRepeats).join(' ')
    if (ADVICE_PHRASES.some((re) => re.test(sentence))) return true
  }
  return /100\s?%\s?(profit|win|cuan|gain|untung)/.test(base)
}

// ------------------------------------------------------------------ target harga

const TARGET_RES = [
  /\b(target|tp|pt|sasaran)\b[^\n.]{0,15}?\d/,
  /\b(price\s*target|take\s*profit|stop\s*loss|cut\s*loss|target\s*harga)\b/,
  /\b(to|ke|reach|reaches|reaching|hit|hits|mencapai|capai|tembus|menembus|menuju|touch)\s*(\$|rp\.?|usd|us\$)\s?\d/,
]

function hasPriceTarget(base: string): boolean {
  return TARGET_RES.some((re) => re.test(base))
}

// -------------------------------------------------------------------------- URL

const TLDS =
  'com|io|xyz|org|net|app|ai|co|id|me|ly|link|finance|fi|gg|to|tv|dev|eth|sol|info|biz|site|online|top|club|cc|us|uk|gl|sh|so|ws|page|live|fun|lol|wtf|bet'

function hasUrl(base: string): boolean {
  const deobf = base
    .replace(/\[\s*\.\s*\]|\(\s*\.\s*\)|\{\s*\.\s*\}/g, '.')
    .replace(/\s*[([{]\s*dot\s*[)\]}]\s*/g, '.')
    .replace(/(?<=[a-z0-9])\s+dot\s+(?=[a-z0-9])/g, '.')
  return (
    /(?:https?|hxxps?|ftp):\/\//.test(deobf) ||
    /\bwww\./.test(deobf) ||
    new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b`).test(deobf)
  )
}

// ------------------------------------------------------------------------ $NEXA

function digitLeet(base: string): string {
  return base.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a')
}

const NEXA_TOKEN_RES = [/\$\s?n\W?e\W?x\W?a(?![a-z])/, /\b(?:token|koin|coin|ticker)\s+nexa\b/, /\bnexa\s+(?:token|coin|koin)\b/]
const NEXA_PRICE_RE =
  /\b(harga|price|mcap|market\s*cap|fdv|naik|turun|pump|dump|moon|ath|volume|chart|bullish|bearish|valuasi|valuation|pairing|liquidity|likuiditas)\b|\d\s?x\b/

export function mentionsNexaToken(base: string): boolean {
  const v = digitLeet(base)
  return NEXA_TOKEN_RES.some((re) => re.test(v))
}

// ------------------------------------------------------------------ disclaimer

const DISCLAIMER_RE = /\b(bukan\s+(nasihat|saran)\s+(keuangan|investasi)|not\s+(a\s+)?financial\s+advice|nfa)\b/
const DISCLAIMER_TYPES: ReadonlySet<ContentType> = new Set(['prediction', 'risk_report', 'mention_reply'])

// -------------------------------------------------------------------- tidak tahu

const UNKNOWN_REPLY_RE =
  /^\s*(maaf[,.! ]*)?(nexa\s+)?(saya\s+)?(tidak\s+tahu|belum\s+(punya|memiliki)\s+data|data\s+(belum\s+|tidak\s+)?(lengkap|tersedia)|i\s+(do\s*n'?t|do\s+not)\s+know|not\s+enough\s+data|insufficient\s+data)/

export function isUnknownReply(base: string): boolean {
  return UNKNOWN_REPLY_RE.test(base)
}

// ----------------------------------------------------------------------- umum

const ADDRESS_RE = /0x[a-f0-9]{40}/g

export interface RuleContext {
  type: ContentType
  text: string
  tokens: { address: string; ageSeconds: number | null }[]
  dataComplete: boolean
  minTokenAgeSeconds: number
}

/** Mengembalikan kode alasan pemblokiran (kosong = lolos semua aturan). */
export function runRules(ctx: RuleContext): ReasonCode[] {
  const base = baseNormalize(ctx.text)
  const reasons = new Set<ReasonCode>()

  if (hasAdvicePhrase(base)) reasons.add(REASON.ADVICE_PHRASE)
  if (hasPriceTarget(base)) reasons.add(REASON.PRICE_TARGET)
  if (hasUrl(base)) reasons.add(REASON.URL)

  // $NEXA: hanya di pengumuman teknis & burn; harga/ajakan tidak pernah.
  if (mentionsNexaToken(base)) {
    if (ctx.type !== 'technical_announcement' && ctx.type !== 'burn_report') reasons.add(REASON.NEXA_MENTION)
    if (NEXA_PRICE_RE.test(base)) reasons.add(REASON.NEXA_PRICE)
  }

  if (ctx.type === 'sponsored' && !/^\s*Sponsored\b/.test(ctx.text.normalize('NFKC').replace(/[\u200b-\u200f\ufeff]/g, ''))) {
    reasons.add(REASON.SPONSORED_LABEL)
  }

  // Token: umur wajib diketahui dan >= batas; setiap alamat di teks harus berasal dari tool result.
  for (const t of ctx.tokens) {
    if (t.ageSeconds === null) reasons.add(REASON.TOKEN_AGE_UNKNOWN)
    else if (t.ageSeconds < ctx.minTokenAgeSeconds) reasons.add(REASON.TOKEN_TOO_NEW)
  }
  const tracked = new Set(ctx.tokens.map((t) => t.address.toLowerCase()))
  for (const addr of base.match(ADDRESS_RE) ?? []) {
    if (!tracked.has(addr)) reasons.add(REASON.UNTRACKED_ADDRESS)
  }

  const unknown = isUnknownReply(base)
  if (!ctx.dataComplete && !unknown) reasons.add(REASON.DATA_INCOMPLETE)

  if (DISCLAIMER_TYPES.has(ctx.type) && !unknown && !DISCLAIMER_RE.test(base)) reasons.add(REASON.MISSING_DISCLAIMER)

  return [...reasons]
}
