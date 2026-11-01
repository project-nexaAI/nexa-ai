import type { MarketResponse } from '@nexa-ai/api-client'

type Point = MarketResponse['assets'][number]['series'][number]

export interface ChartGeometry {
  oracle: string
  area: string
  /** Garis DEX; titik yang tidak punya harga DEX membuat garis putus (tidak diisi-tebak). Null bila tidak ada satu pun. */
  dex: string | null
  last: { x: number; y: number }
}

/**
 * Geometri grafik dua garis (oracle dan DEX) pada skala vertikal yang sama. Nilai diubah ke Number hanya untuk
 * menggambar; angka yang ditampilkan tetap dari nilai mentah/terformat API. Kurang dari 2 titik = null.
 */
export function chartGeometry(series: readonly Point[], decimals: number, w = 590, top = 12, bottom = 112): ChartGeometry | null {
  if (series.length < 2) return null
  const scale = 10 ** decimals
  const o = series.map((p) => Number(p.oracle) / scale)
  const d = series.map((p) => (p.dex === null ? null : Number(p.dex) / scale))
  const all = [...o, ...d.filter((v): v is number => v !== null)]
  let min = Math.min(...all)
  let max = Math.max(...all)
  if (max === min) {
    min -= 1
    max += 1
  }
  const x = (i: number) => (i / (series.length - 1)) * w
  const y = (v: number) => top + ((max - v) / (max - min)) * (bottom - top)
  const f = (n: number) => n.toFixed(1)

  const oracle = o.map((v, i) => `${i === 0 ? 'M' : 'L'}${f(x(i))} ${f(y(v))}`).join('')
  const area = `${oracle}L${f(w)} ${bottom + 8}L0 ${bottom + 8}Z`
  let dex = ''
  let run = false
  d.forEach((v, i) => {
    if (v === null) {
      run = false
      return
    }
    dex += `${run ? 'L' : 'M'}${f(x(i))} ${f(y(v))}`
    run = true
  })
  return { oracle, area, dex: dex || null, last: { x: w, y: y(o[o.length - 1]!) } }
}
