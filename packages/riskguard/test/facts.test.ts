import { describe, expect, it } from 'vitest'
import { evaluate } from '../src'

const FACTS = ['142.10', '35 bps', '0.35%', '7']
const run = (text: string, facts: string[] | null = FACTS) =>
  evaluate({ type: 'prediction', text, dataComplete: true, ...(facts ? { facts } : {}) })
const NFA = 'Bukan nasihat keuangan.'

describe('angka harus terlacak ke tool result (aturan pipeline 3)', () => {
  it('lolos: semua angka ada di fakta', () => {
    expect(run(`NVDA 142.10, premium DEX 35 bps (0.35%) di atas oracle. Horizon 7 hari. ${NFA}`).reasons).toEqual([])
  })

  it('diblokir: halusinasi nyata dari LLM, "35 bps" ditulis "+3,5%"', () => {
    const d = run(`NVDA 142.10, premium DEX 35 bps (+3,5%) di atas oracle. Horizon 7 hari. ${NFA}`)
    expect(d.allowed).toBe(false)
    expect(d.reasons).toContain('NUMBER_UNTRACED')
  })

  it('diblokir: angka karangan, EN dan ID', () => {
    expect(run(`NVDA at 150.25 today, horizon 7 days. ${NFA}`).reasons).toContain('NUMBER_UNTRACED')
    expect(run(`Volume naik 12% dalam 7 hari. ${NFA}`).reasons).toContain('NUMBER_UNTRACED')
  })

  it('koma desimal dan titik desimal dianggap sama', () => {
    expect(run(`NVDA 142,10 dan 0,35% dalam 7 hari. ${NFA}`).reasons).toEqual([])
  })

  it('pemisah ribuan dinormalkan', () => {
    const d = evaluate({ type: 'prediction', text: `Volume 1.234.567 dalam 7 hari. ${NFA}`, dataComplete: true, facts: ['1,234,567', '7'] })
    expect(d.reasons).toEqual([])
  })

  it('angka di dalam alamat/hash 0x tidak dihitung', () => {
    const addr = '0x1111111111111111111111111111111111111111'
    const d = evaluate({
      type: 'prediction',
      text: `Kontrak ${addr}, horizon 7 hari. ${NFA}`,
      dataComplete: true,
      tokens: [{ address: addr, ageSeconds: 7200 }],
      facts: ['7'],
    })
    expect(d.reasons).toEqual([])
  })

  it('tanpa facts: aturan dilewati (kompatibel dengan pemanggil lama)', () => {
    expect(run(`NVDA 999 dalam 5 hari. ${NFA}`, null).reasons).not.toContain('NUMBER_UNTRACED')
  })

  it('facts kosong: teks ber-angka diblokir', () => {
    expect(run(`NVDA 142.10. ${NFA}`, []).reasons).toContain('NUMBER_UNTRACED')
  })

  it('teks tanpa angka lolos', () => {
    expect(run(`NVDA diprediksi ditutup lebih tinggi. ${NFA}`, []).reasons).toEqual([])
  })
})
