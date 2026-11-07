import { describe, expect, it } from 'vitest'
import { THRESHOLDS, buildSignals, riskLevelOf, type SignalInput } from '../src/ask-signals'

const calm: SignalInput = {
  creatorTaxBps: 100,
  topHolderShareBps: 300,
  top10ShareBps: 2000,
  uniqueTraders: 40,
  tradesLast24h: 120,
  buyVolume: 1_000_000n,
  sellVolume: 400_000n,
  creatorSells: 0,
  creatorSellVolume: 0n,
}
const level = (i: SignalInput, id: string) => buildSignals(i).find((s) => s.id === id)!.level

describe('buildSignals', () => {
  it('token tenang: semua sinyal ok dan ringkasan low', () => {
    const s = buildSignals(calm)
    expect(s.map((x) => x.level)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'])
    expect(riskLevelOf(s)).toBe('low')
  })

  it('creator tax: ambang watch dan risk', () => {
    expect(level({ ...calm, creatorTaxBps: THRESHOLDS.creatorTaxWatchBps }, 'creator_tax')).toBe('ok')
    expect(level({ ...calm, creatorTaxBps: THRESHOLDS.creatorTaxWatchBps + 1 }, 'creator_tax')).toBe('watch')
    expect(level({ ...calm, creatorTaxBps: THRESHOLDS.creatorTaxRiskBps + 1 }, 'creator_tax')).toBe('risk')
    expect(level({ ...calm, creatorTaxBps: null }, 'creator_tax')).toBe('unknown')
  })

  it('konsentrasi holder: top holder dan top 10', () => {
    expect(level({ ...calm, topHolderShareBps: 1000 }, 'top_holder')).toBe('watch')
    expect(level({ ...calm, topHolderShareBps: 2000 }, 'top_holder')).toBe('risk')
    expect(level({ ...calm, topHolderShareBps: null }, 'top_holder')).toBe('unknown')
    expect(level({ ...calm, top10ShareBps: 4000 }, 'top10')).toBe('watch')
    expect(level({ ...calm, top10ShareBps: 6000 }, 'top10')).toBe('risk')
    expect(level({ ...calm, top10ShareBps: null }, 'top10')).toBe('unknown')
  })

  it('partisipasi tipis: sedikit wallet unik', () => {
    expect(level({ ...calm, uniqueTraders: 9 }, 'participation')).toBe('watch')
    expect(level({ ...calm, uniqueTraders: 2 }, 'participation')).toBe('risk')
  })

  it('tanpa trade 24 jam terakhir = watch', () => {
    expect(level({ ...calm, tradesLast24h: 0 }, 'recent_activity')).toBe('watch')
  })

  it('tekanan jual: volume jual terhadap volume beli; tanpa volume beli = unknown', () => {
    expect(level({ ...calm, sellVolume: 900_000n }, 'sell_pressure')).toBe('watch')
    expect(level({ ...calm, buyVolume: 0n, sellVolume: 0n }, 'sell_pressure')).toBe('unknown')
  })

  it('creator menjual: satu penjualan = watch, porsi besar dari volume jual = risk', () => {
    expect(level({ ...calm, creatorSells: 1, creatorSellVolume: 10_000n }, 'creator_selling')).toBe('watch')
    expect(level({ ...calm, creatorSells: 2, creatorSellVolume: 200_000n }, 'creator_selling')).toBe('risk')
  })
})

describe('riskLevelOf', () => {
  it('satu risk = high, satu watch = medium', () => {
    expect(riskLevelOf(buildSignals({ ...calm, creatorTaxBps: 900 }))).toBe('high')
    expect(riskLevelOf(buildSignals({ ...calm, tradesLast24h: 0 }))).toBe('medium')
  })

  it('banyak sinyal tidak diketahui = unknown, bukan low', () => {
    const blind: SignalInput = { ...calm, creatorTaxBps: null, topHolderShareBps: null, top10ShareBps: null, buyVolume: 0n, sellVolume: 0n }
    expect(riskLevelOf(buildSignals(blind))).toBe('unknown')
  })

  it('teks sinyal tidak memuat ajakan beli atau jual', () => {
    const text = buildSignals({ ...calm, creatorTaxBps: 900, tradesLast24h: 0 })
      .map((s) => `${s.label} ${s.value} ${s.note}`)
      .join(' ')
      .toLowerCase()
    expect(text).not.toMatch(/\b(buy now|sell now|should buy|should sell|guaranteed)\b/)
  })
})
