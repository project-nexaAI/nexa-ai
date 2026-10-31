import { describe, expect, it } from 'vitest'
import type { Address, Hex } from 'viem'
import { DEFAULT_KEEPER_CONFIG, mirrorPrices, type KeeperDeps, type MirrorFeed } from '../src/keeper'
import type { FeedReader } from '../src/oracle'

const SRC = '0x00000000000000000000000000000000000000a1' as Address
const TGT = '0x00000000000000000000000000000000000000b1' as Address
const mirrors: MirrorFeed[] = [{ symbol: 'NVDA', source: SRC, target: TGT }]
const NOW = 1_800_000_000n
const HEX = ('0x' + '11'.repeat(32)) as Hex

function setup(opts: {
  src?: { answer: bigint; updatedAt: bigint; decimals?: number } | Error
  tgt?: { answer: bigint; updatedAt: bigint; decimals?: number } | Error
  pushFails?: boolean
}) {
  const pushes: { target: Address; answer: bigint; updatedAt: bigint }[] = []
  const reader =
    (v: { answer: bigint; updatedAt: bigint; decimals?: number } | Error | undefined): FeedReader =>
    async () => {
      if (!v || v instanceof Error) throw v ?? new Error('tidak ada')
      return { answer: v.answer, updatedAt: v.updatedAt, decimals: v.decimals ?? 8 }
    }
  const deps: KeeperDeps = {
    readSource: reader(opts.src),
    readTarget: reader(opts.tgt),
    push: async (target, answer, updatedAt) => {
      if (opts.pushFails) throw new Error('rpc mati')
      pushes.push({ target, answer, updatedAt })
      return HEX
    },
    chainNowSec: async () => NOW,
    sourceNowSec: () => NOW,
    cfg: DEFAULT_KEEPER_CONFIG,
    mirrors,
  }
  return { deps, pushes }
}

const price = (usd: number) => BigInt(Math.round(usd * 1e8))

describe('keeper feed tiruan testnet', () => {
  it('heartbeat habis: dorong harga sumber dengan waktu chain testnet', async () => {
    const { deps, pushes } = setup({ src: { answer: price(205), updatedAt: NOW - 60n }, tgt: { answer: price(205), updatedAt: NOW - 7n * 3600n } })
    const [r] = await mirrorPrices(deps)
    expect(r).toMatchObject({ symbol: 'NVDA', action: 'pushed', txHash: HEX })
    expect(pushes).toEqual([{ target: TGT, answer: price(205), updatedAt: NOW }])
  })

  it('harga bergeser >= 0,5%: dorong walau heartbeat belum habis', async () => {
    const { deps, pushes } = setup({ src: { answer: price(206.1), updatedAt: NOW - 60n }, tgt: { answer: price(205), updatedAt: NOW - 600n } })
    expect((await mirrorPrices(deps))[0]!.action).toBe('pushed')
    expect(pushes).toHaveLength(1)
  })

  it('masih segar dan geser kecil: tidak mendorong (hemat gas)', async () => {
    const { deps, pushes } = setup({ src: { answer: price(205.2), updatedAt: NOW - 60n }, tgt: { answer: price(205), updatedAt: NOW - 600n } })
    expect((await mirrorPrices(deps))[0]!.action).toBe('fresh_enough')
    expect(pushes).toHaveLength(0)
  })

  it('sumber basi, nol, atau gagal dibaca: tidak menyalin apa pun', async () => {
    const stale = setup({ src: { answer: price(205), updatedAt: NOW - 4n * 86_400n }, tgt: { answer: 1n, updatedAt: 0n } })
    expect((await mirrorPrices(stale.deps))[0]!.action).toBe('source_stale')
    const zero = setup({ src: { answer: 0n, updatedAt: NOW }, tgt: { answer: 1n, updatedAt: 0n } })
    expect((await mirrorPrices(zero.deps))[0]!.action).toBe('source_stale')
    const err = setup({ src: new Error('rpc mati'), tgt: { answer: 1n, updatedAt: 0n } })
    expect((await mirrorPrices(err.deps))[0]!.action).toBe('source_error')
    expect(stale.pushes.length + zero.pushes.length + err.pushes.length).toBe(0)
  })

  it('desimal berbeda dan target tak terbaca dilewati; push gagal dilaporkan tanpa melempar', async () => {
    const dec = setup({ src: { answer: price(205), updatedAt: NOW, decimals: 8 }, tgt: { answer: 1n, updatedAt: 0n, decimals: 18 } })
    expect((await mirrorPrices(dec.deps))[0]!.action).toBe('decimals_mismatch')
    const bad = setup({ src: { answer: price(205), updatedAt: NOW }, tgt: new Error('x') })
    expect((await mirrorPrices(bad.deps))[0]!.action).toBe('target_error')
    const fail = setup({ src: { answer: price(205), updatedAt: NOW }, tgt: { answer: price(205), updatedAt: 0n }, pushFails: true })
    expect((await mirrorPrices(fail.deps))[0]!.action).toBe('push_failed')
  })

  it('target belum punya round (harga 0): langsung didorong', async () => {
    const { deps, pushes } = setup({ src: { answer: price(205), updatedAt: NOW }, tgt: { answer: 0n, updatedAt: 0n } })
    expect((await mirrorPrices(deps))[0]!.action).toBe('pushed')
    expect(pushes).toHaveLength(1)
  })
})
