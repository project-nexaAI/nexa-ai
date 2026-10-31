import { describe, expect, it } from 'vitest'
import { DIRECTION } from '../src'
import { scoreCall } from '../src/scoring'

const D = 8
const p = (usd: number) => BigInt(Math.round(usd * 10 ** D))

describe('scoreCall (sama dengan NexaLedger.reveal)', () => {
  it('naik menang bila harga naik; return dalam bps', () => {
    expect(scoreCall({ direction: DIRECTION.UP, startPrice: p(100), endPrice: p(105) })).toEqual({ returnBps: 500, won: true })
  })
  it('turun menang bila harga turun; return mentah negatif', () => {
    expect(scoreCall({ direction: DIRECTION.DOWN, startPrice: p(100), endPrice: p(90) })).toEqual({ returnBps: -1000, won: true })
  })
  it('arah salah kalah; harga datar kalah untuk kedua arah', () => {
    expect(scoreCall({ direction: DIRECTION.UP, startPrice: p(100), endPrice: p(99) }).won).toBe(false)
    expect(scoreCall({ direction: DIRECTION.UP, startPrice: p(100), endPrice: p(100) }).won).toBe(false)
    expect(scoreCall({ direction: DIRECTION.DOWN, startPrice: p(100), endPrice: p(100) }).won).toBe(false)
  })
  it('minMoveBps: gerak di bawah ambang tidak menang', () => {
    expect(scoreCall({ direction: DIRECTION.UP, startPrice: p(100), endPrice: p(100.5), minMoveBps: 100 }).won).toBe(false)
    expect(scoreCall({ direction: DIRECTION.UP, startPrice: p(100), endPrice: p(101), minMoveBps: 100 }).won).toBe(true)
  })
  it('pembagian bulat ke nol seperti Solidity; harga awal nol ditolak', () => {
    expect(scoreCall({ direction: DIRECTION.DOWN, startPrice: 30000n, endPrice: 29999n }).returnBps).toBe(0)
    expect(() => scoreCall({ direction: DIRECTION.UP, startPrice: 0n, endPrice: 1n })).toThrow()
  })
})
