import { bpsToPercent } from '../src/oracle'

/**
 * Persona NEXA (bahasa post: Inggris, keputusan pemilik 2026-11-01). "Superintelligence" adalah persona; kecerdasannya
 * dibuktikan dengan data, bukan klaim. RiskGuard (kode) tetap menjadi penjaga terakhir; prompt ini hanya mengurangi penolakan.
 */
export const PERSONA_SYSTEM = `You are NEXA, an AI on-chain analyst agent on Robinhood Chain. Style: calm, sharp, brief, data-driven.

Hard rules (a post that breaks them is discarded by a filter):
- Use ONLY numbers and facts from the DATA provided. Never invent numbers. If the data is not enough, say you do not know.
- Never use the words buy/sell/purchase, any call to action, "guaranteed" or "sure to go up", or any price target.
- ALL numbers in the text must appear exactly as written in DATA (e.g. "35 bps" or "0.35%"). Do not compute, round, or convert into new numbers. A number that is not in DATA gets the post discarded.
- Write prices as "sits at $X" or "trades at $X", never "heading to $X" or "to $X".
- For movement reports use neutral terms: "inflow/outflow", "accumulation", "distribution", "transfer".
- Never write URLs, domains, or links.
- Never discuss $NEXA or the NEXA token, its price, or its pairing.
- Never claim certainty. A prediction is only a direction (up/down) and a horizon.
- A prediction MUST end with exactly this sentence: "Not financial advice."
- Write in English. Maximum 260 characters.`

export interface PredictionCandidate {
  symbol: string
  asset: `0x${string}`
  /** Harga oracle terformat (bukan tebakan), dari tool result. */
  oraclePrice: string
  /** Selisih harga DEX vs oracle dalam bps jika tersedia. */
  dexVsOracleBps?: number
  /** Perubahan harga oracle dalam jendela jam yang tertera (dari riwayat round). Tidak ada = riwayat tidak cukup. */
  change24h?: { bps: number; windowHours: number }
}

/** Fakta bernilai angka dari satu kandidat; dipakai prompt dan RiskGuard (angka di teks harus ada di sini). */
export function candidateFacts(c: PredictionCandidate, horizonDays: number): string[] {
  const facts = [c.oraclePrice, String(horizonDays)]
  if (c.dexVsOracleBps !== undefined) facts.push(`${c.dexVsOracleBps} bps`, `${(c.dexVsOracleBps / 100).toFixed(2)}%`)
  if (c.change24h) facts.push(`${bpsToPercent(c.change24h.bps)}%`, `${Math.abs(c.change24h.bps)} bps`, String(c.change24h.windowHours))
  return facts
}

export function buildPredictionPrompt(candidates: readonly PredictionCandidate[], horizonDays: number): string {
  return `Pick ONE asset from DATA and write the Prediction of the Day: the price direction (up or down) over ${horizonDays} days.

DATA (tool results, the only source of numbers):
${JSON.stringify(
  candidates.map((c) => ({
    symbol: c.symbol,
    oraclePrice: c.oraclePrice,
    dexVsOracle: c.dexVsOracleBps === undefined ? null : `${c.dexVsOracleBps} bps (${(c.dexVsOracleBps / 100).toFixed(2)}%)`,
    change: c.change24h
      ? { direction: c.change24h.bps === 0 ? 'flat' : c.change24h.bps > 0 ? 'up' : 'down', percent: `${bpsToPercent(Math.abs(c.change24h.bps))}%`, bps: `${Math.abs(c.change24h.bps)} bps`, hours: c.change24h.windowHours }
      : null,
    horizonDays,
  })),
)}

Pick the asset with the most complete data. If "change" is present, mention it once as a brief basis (for example momentum or a reversal), without claiming certainty and without any other numbers.

Reply with JSON ONLY: {"symbol": "<one of the symbols in DATA>", "direction": "up" | "down", "text": "<post text, ending with 'Not financial advice.'>"}`
}
