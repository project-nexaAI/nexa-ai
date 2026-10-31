/** Semua waktu UTC. */
export function fmtUtc(iso: string): string {
  const d = new Date(iso)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`
}

export function fmtAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86_400)}d ${Math.floor((seconds % 86_400) / 3600)}h`
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-8)}`
}

export function bpsText(bps: number | null): string {
  return bps === null ? '—' : `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}
