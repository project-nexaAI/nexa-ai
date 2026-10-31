import { describe, expect, it } from 'vitest'
import { formatUsd, readOracleCandidates, type FeedReader, type OracleAsset } from '../src/oracle'

const NOW = 1_800_000_000n
const NVDA_FEED = '0x00000000000000000000000000000000000000f1'
const ETH_FEED = '0x00000000000000000000000000000000000000f2'
const assets: OracleAsset[] = [
  { symbol: 'NVDA', asset: '0x00000000000000000000000000000000000000a1', feed: NVDA_FEED },
  { symbol: 'ETH', asset: '0x00000000000000000000000000000000000000a2', feed: ETH_FEED },
]
const reader = (m: Record<string, { answer: bigint; updatedAt: bigint } | Error>): FeedReader => async (feed) => {
  const v = m[feed]
  if (!v || v instanceof Error) throw v ?? new Error('tidak ada')
  return { ...v, decimals: 8 }
}

describe('formatUsd', () => {
  it('memotong ke 2 desimal tanpa float', () => {
    expect(formatUsd(20528000142n, 8)).toBe('205.28')
    expect(formatUsd(223656917030n, 8)).toBe('2236.56')
    expect(formatUsd(500000000n, 8)).toBe('5.00')
  })
})

describe('readOracleCandidates', () => {
  it('memberi harga terformat dari feed yang segar', async () => {
    const r = await readOracleCandidates(reader({ [NVDA_FEED]: { answer: 20528000142n, updatedAt: NOW - 60n }, [ETH_FEED]: { answer: 223656917030n, updatedAt: NOW - 60n } }), assets, NOW)
    expect(r.map((c) => [c.symbol, c.oraclePrice])).toEqual([
      ['NVDA', '$205.28'],
      ['ETH', '$2236.56'],
    ])
  })

  it('membuang feed basi, harga nol/negatif, dan feed yang gagal dibaca', async () => {
    const r = await readOracleCandidates(
      reader({ [NVDA_FEED]: { answer: 1n, updatedAt: NOW - 4n * 86_400n }, [ETH_FEED]: { answer: -5n, updatedAt: NOW } }),
      assets,
      NOW,
    )
    expect(r).toEqual([])
    expect(await readOracleCandidates(reader({ [ETH_FEED]: new Error('rpc mati') }), assets, NOW)).toEqual([])
  })

  it('feed belum diketahui (null) dilewati', async () => {
    expect(await readOracleCandidates(reader({}), [{ ...assets[0]!, feed: null as unknown as `0x${string}` }], NOW)).toEqual([])
  })
})
