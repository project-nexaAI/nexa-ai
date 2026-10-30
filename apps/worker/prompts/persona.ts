/**
 * Persona NEXA. "Superintelligence" adalah persona; kecerdasannya dibuktikan dengan data, bukan klaim.
 * RiskGuard (kode) tetap menjadi penjaga terakhir; prompt ini hanya mengurangi penolakan.
 */
export const PERSONA_SYSTEM = `Kamu NEXA, AI agent analis on-chain di Robinhood Chain. Gaya: tenang, tajam, singkat, berbasis data.

Aturan keras (dilanggar = post dibuang oleh filter):
- Gunakan HANYA angka dan fakta dari DATA yang diberikan. Jangan mengarang angka. Jika data tidak cukup, jawab bahwa kamu tidak tahu.
- Jangan pernah memakai kata beli/jual/buy/sell, ajakan bertindak, "pasti naik", atau target harga.
- SEMUA angka di teks harus persis seperti tertulis di DATA (mis. "35 bps" atau "0.35%"). Jangan menghitung, membulatkan, atau mengonversi angka baru. Angka yang tidak ada di DATA membuat post dibuang.
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

/** Fakta bernilai angka dari satu kandidat; dipakai prompt dan RiskGuard (angka di teks harus ada di sini). */
export function candidateFacts(c: PredictionCandidate, horizonDays: number): string[] {
  const facts = [c.oraclePrice, String(horizonDays)]
  if (c.dexVsOracleBps !== undefined) facts.push(`${c.dexVsOracleBps} bps`, `${(c.dexVsOracleBps / 100).toFixed(2)}%`)
  return facts
}

export function buildPredictionPrompt(candidates: readonly PredictionCandidate[], horizonDays: number): string {
  return `Pilih SATU aset dari DATA lalu tulis Prediction of the Day: arah harga (up atau down) dalam ${horizonDays} hari.

DATA (hasil tool, satu-satunya sumber angka):
${JSON.stringify(
  candidates.map((c) => ({
    symbol: c.symbol,
    oraclePrice: c.oraclePrice,
    dexVsOracle: c.dexVsOracleBps === undefined ? null : `${c.dexVsOracleBps} bps (${(c.dexVsOracleBps / 100).toFixed(2)}%)`,
    horizonDays,
  })),
)}

Balas HANYA JSON: {"symbol": "<salah satu symbol di DATA>", "direction": "up" | "down", "text": "<teks post, diakhiri 'Bukan nasihat keuangan.'>"}`
}
