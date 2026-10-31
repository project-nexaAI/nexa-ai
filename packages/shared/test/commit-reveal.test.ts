import { describe, expect, it } from 'vitest'
import vectors from '../test-vectors/commit-reveal.json'
import { computePredictionHash, type Direction } from '../src/commit-reveal'

describe('computePredictionHash', () => {
  it.each(vectors.vectors)('cocok dengan vektor bersama Solidity: "$text"', (v) => {
    expect(
      computePredictionHash({
        text: v.text,
        asset: v.asset as `0x${string}`,
        direction: v.direction as Direction,
        horizon: v.horizon,
        salt: v.salt as `0x${string}`,
      }),
    ).toBe(v.hash)
  })

  it('setiap field mengubah hash', () => {
    const v = vectors.vectors[0]!
    const base = {
      text: v.text,
      asset: v.asset as `0x${string}`,
      direction: v.direction as Direction,
      horizon: v.horizon,
      salt: v.salt as `0x${string}`,
    }
    const h = computePredictionHash(base)
    expect(computePredictionHash({ ...base, text: base.text + '.' })).not.toBe(h)
    expect(computePredictionHash({ ...base, direction: 2 })).not.toBe(h)
    expect(computePredictionHash({ ...base, horizon: base.horizon + 1 })).not.toBe(h)
    expect(computePredictionHash({ ...base, salt: `0x${'22'.repeat(32)}` })).not.toBe(h)
  })
})
