import { describe, expect, it } from 'vitest'
import { bpsToPercent, priceChange, type FeedHistory, type RoundInfo } from '../src/oracle'

const FEED = '0x00000000000000000000000000000000000000f1' as const
const H = 3600n

/** Riwayat palsu: daftar round (id naik) dengan [answer, updatedAt]. */
function history(rounds: [bigint, bigint][], decimals = 8): FeedHistory {
  const info = (i: number): RoundInfo => ({ roundId: BigInt(i + 1), answer: rounds[i]![0], updatedAt: rounds[i]![1] })
  return {
    latest: async () => ({ ...info(rounds.length - 1), decimals }),
    round: async (_f, id) => {
      const i = Number(id) - 1
      return i >= 0 && i < rounds.length ? info(i) : null
    },
  }
}

describe('priceChange', () => {
  const T = 1_000_000n * H

  it('membandingkan dengan round terakhir yang berumur >= 24 jam; hasil bps bulat tanpa float', async () => {
    const h = history([
      [20_000_000_000n, T - 40n * H],
      [20_000_000_000n, T - 25n * H], // round terakhir <= T-24h
      [20_100_000_000n, T - 10n * H],
      [20_070_000_000n, T], // terbaru: +35 bps dari 200.00
    ])
    expect(await priceChange(h, FEED)).toEqual({ changeBps: 35, windowHours: 25 })
  })

  it('turun dibulatkan ke nol: -0,3499% = -34 bps', async () => {
    const h = history([[20_000_000_000n, T - 24n * H], [19_930_000_000n, T]])
    expect((await priceChange(h, FEED))?.changeBps).toBe(-35)
    const h2 = history([[20_000_000_000n, T - 24n * H], [19_930_100_000n, T]])
    expect((await priceChange(h2, FEED))?.changeBps).toBe(-34)
  })

  it('riwayat tidak cukup, harga nol, atau selang terlalu panjang = null (tidak ditebak)', async () => {
    expect(await priceChange(history([[20_000_000_000n, T]]), FEED)).toBeNull() // satu round saja
    expect(await priceChange(history([[20_000_000_000n, T - 2n * H], [20_000_000_000n, T]]), FEED)).toBeNull() // tak ada round cukup tua
    expect(await priceChange(history([[0n, T - 30n * H], [20_000_000_000n, T]]), FEED)).toBeNull()
    expect(await priceChange(history([[20_000_000_000n, T - 100n * H], [20_000_000_000n, T]]), FEED)).toBeNull() // 100 jam > 2x jendela
  })

  it('galat baca = null', async () => {
    const broken: FeedHistory = { latest: async () => { throw new Error('rpc') }, round: async () => null }
    expect(await priceChange(broken, FEED)).toBeNull()
  })
})

describe('bpsToPercent', () => {
  it('format persen dua desimal dari bps', () => {
    expect(bpsToPercent(35)).toBe('0.35')
    expect(bpsToPercent(-120)).toBe('-1.20')
    expect(bpsToPercent(0)).toBe('0.00')
    expect(bpsToPercent(1234)).toBe('12.34')
    expect(bpsToPercent(-5)).toBe('-0.05')
  })
})
