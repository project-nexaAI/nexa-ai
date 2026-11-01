import { z } from 'zod'
import { sponsoredReports } from '@nexa-ai/db'
import { REPORT_SYSTEM } from '../prompts/reports'
import { recordLlmCosts } from './cycle'
import { loadTokenFacts, type TokenFacts } from './facts'
import { generateStructured, type LlmClient } from './llm'
import { bpsToPercent } from './oracle'
import { enqueuePost, type Db, type EnqueueResult, type PostMode } from './queue'

export interface SponsoredDeps {
  db: Db
  llm: LlmClient
  mode: PostMode
}

export interface SponsoredRequest {
  /** Nama klien (label operator), mis. nama proyek. */
  client: string
  /** Kontrak token yang diriset; harus sudah ada di indexer dan berumur >= 1 jam. */
  token: string
  /** Bukti pembayaran ($750): hash tx, nomor invoice, dsb. */
  paymentRef: string
}

export class SponsoredError extends Error {}

const requestSchema = z.object({
  client: z.string().trim().regex(/^[A-Za-z0-9 .&'_-]{1,40}$/, 'nama klien 1-40 karakter (huruf, angka, spasi, . & \' _ -)'),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'alamat token tidak valid'),
  paymentRef: z.string().trim().min(3).max(120),
})
const textSchema = z.object({ text: z.string().min(10).max(280) })

const sponsoredSystem = `${REPORT_SYSTEM}
- This is SPONSORED CONTENT. The text MUST start with exactly the word "Sponsored" followed by a colon. Keep the research neutral: state the data as it is, with no recommendation, rating, top pick, or call to action. Say once that this is paid content from the client.`

function factsFor(f: TokenFacts): string[] {
  const out = [String(f.trades.total), String(f.trades.buys), String(f.trades.sells)]
  if (f.creatorTaxBps !== null) out.push(`${bpsToPercent(f.creatorTaxBps)}%`, `${f.creatorTaxBps} bps`)
  if (f.topHolderShareBps !== null) out.push(`${bpsToPercent(f.topHolderShareBps)}%`, `${f.topHolderShareBps} bps`)
  return out
}

function promptFor(client: string, f: TokenFacts): string {
  const data = {
    client,
    symbol: f.symbol ?? 'token without a safe symbol to display',
    graduated: f.graduated,
    trades: f.trades,
    creatorTax: f.creatorTaxBps === null ? null : `${bpsToPercent(f.creatorTaxBps)}% (${f.creatorTaxBps} bps)`,
    topHolderShare: f.topHolderShareBps === null ? null : `${bpsToPercent(f.topHolderShareBps)}% (${f.topHolderShareBps} bps)`,
    redFlags: f.redFlags,
  }
  return `Write a research summary labeled "Sponsored" about the client's token, from the indexer DATA only. Include the red flags as they are (do not hide them, do not praise).

DATA (tool results, the only source of numbers):
${JSON.stringify(data)}

Reply with JSON ONLY: {"text": "Sponsored: <post text>"}`
}

/**
 * Alur internal konten sponsor ($750 per laporan): data indexer -> LLM (model besar) -> RiskGuard tipe `sponsored`
 * (wajib berawalan "Sponsored", tanpa rekomendasi) -> antrian persetujuan manusia. Sponsor tidak pernah mengubah angka:
 * red flag tetap ditampilkan. Token tidak dikenal atau < 1 jam ditolak sebelum LLM dipanggil.
 */
export async function createSponsoredPost(d: SponsoredDeps, req: SponsoredRequest, now = new Date()): Promise<{ reportId: number; postId: number; status: EnqueueResult['status'] }> {
  const p = requestSchema.safeParse(req)
  if (!p.success) throw new SponsoredError(p.error.issues.map((i) => i.message).join('; '))
  const facts = await loadTokenFacts(d.db, p.data.token, now)
  if (!facts) throw new SponsoredError('token tidak dikenal indexer; tidak ada data untuk ditulis')
  if (facts.ageSeconds < 3600) throw new SponsoredError('token berumur < 1 jam; tidak dibahas (aturan RiskGuard)')

  const { value, usages } = await generateStructured(d.llm, textSchema, { tier: 'large', system: sponsoredSystem, user: promptFor(p.data.client, facts) })
  await recordLlmCosts(d.db, usages)
  const r = await enqueuePost(d.db, {
    kind: 'sponsored',
    mode: d.mode,
    now,
    input: { type: 'sponsored', text: value.text, tokens: [{ address: facts.address, ageSeconds: facts.ageSeconds }], dataComplete: true, facts: factsFor(facts) },
  })
  const [row] = await d.db
    .insert(sponsoredReports)
    .values({ client: p.data.client, token: facts.address, paymentRef: p.data.paymentRef, postId: r.id })
    .returning({ id: sponsoredReports.id })
  return { reportId: row!.id, postId: r.id, status: r.status }
}
