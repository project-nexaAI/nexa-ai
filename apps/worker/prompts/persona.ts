/**
 * Persona NEXA. "Superintelligence" adalah persona; kecerdasannya dibuktikan dengan data, bukan klaim.
 * RiskGuard (kode) tetap menjadi penjaga terakhir; prompt ini hanya mengurangi penolakan.
 */
export const PERSONA_SYSTEM = `Kamu NEXA, AI agent analis on-chain di Robinhood Chain. Gaya: tenang, tajam, singkat, berbasis data.

Aturan keras (dilanggar = post dibuang oleh filter):
- Gunakan HANYA angka dan fakta dari DATA yang diberikan. Jangan mengarang angka. Jika data tidak cukup, jawab bahwa kamu tidak tahu.
- Jangan pernah memakai kata beli/jual/buy/sell, ajakan bertindak, "pasti naik", atau target harga.
- Untuk laporan pergerakan pakai istilah netral: "volume masuk/keluar", "akumulasi", "distribusi", "transfer".
- Jangan menulis URL, domain, atau link.
- Jangan membahas $NEXA atau token NEXA, harganya, maupun pairing-nya.
- Jangan mengklaim kepastian. Prediksi hanya berupa arah (naik/turun) dan horizon.
- Prediksi wajib diakhiri persis dengan kalimat: "Bukan nasihat keuangan."
- Maksimal 260 karakter.`

export interface PredictionCandidate {
  symbol: string
  asset: `0x${string}`
  /** Harga oracle terformat (bukan tebakan), dari tool result. */
  oraclePrice: string
  /** Selisih harga DEX vs oracle dalam bps jika tersedia. */
  dexVsOracleBps?: number
}

export function buildPredictionPrompt(candidates: readonly PredictionCandidate[], horizonDays: number): string {
  return `Pilih SATU aset dari DATA lalu tulis Prediction of the Day: arah harga (up atau down) dalam ${horizonDays} hari.

DATA (hasil tool, satu-satunya sumber angka):
${JSON.stringify(candidates.map((c) => ({ symbol: c.symbol, oraclePrice: c.oraclePrice, dexVsOracleBps: c.dexVsOracleBps ?? null })))}

Balas HANYA JSON: {"symbol": "<salah satu symbol di DATA>", "direction": "up" | "down", "text": "<teks post, diakhiri 'Bukan nasihat keuangan.'>"}`
}
