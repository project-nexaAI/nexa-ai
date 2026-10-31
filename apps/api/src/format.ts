/** Nilai terformat untuk web (nilai mentah tetap dikirim terpisah). */

export function formatBps(bps: number): string {
  const sign = bps > 0 ? '+' : bps < 0 ? '-' : ''
  return `${sign}${(Math.abs(bps) / 100).toFixed(2)}%`
}

export function formatWinRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/** Jumlah token terformat dari unit terkecil, tanpa nol di belakang koma ("1234.5"). */
export function formatUnits(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}
