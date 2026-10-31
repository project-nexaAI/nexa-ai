import type { Address, Hex } from 'viem'
import type { FeedReader } from './oracle'

/**
 * KEEPER TESTNET. Robinhood Chain Testnet tidak punya feed Chainlink, jadi NexaLedger testnet memakai MockAggregator.
 * Keeper menyalin harga feed Chainlink MAINNET (NVDA, ETH) ke feed tiruan itu, mirip perilaku Chainlink asli:
 * dorong round baru saat heartbeat habis atau harga bergeser >= deviationBps. Tanpa round baru setelah jatuh tempo,
 * reveal prediksi gagal ("belum ada round oracle setelah jatuh tempo").
 *
 * Memakai wallet SENDIRI (KEEPER_PRIVATE_KEY), bukan wallet agent: agent hanya boleh commit() dan reveal().
 * MockAggregator.push() terbuka untuk siapa pun, jadi ini hanya berlaku di testnet.
 */
export interface MirrorFeed {
  symbol: string
  /** Feed Chainlink asli di mainnet. */
  source: Address
  /** MockAggregator di testnet. */
  target: Address
}

export interface KeeperConfig {
  /** Dorong round baru bila round target lebih tua dari ini. */
  heartbeatSeconds: number
  /** Dorong bila harga sumber berbeda dari target sebesar ini (bps). */
  deviationBps: number
  /** Harga sumber lebih tua dari ini dianggap basi: tidak disalin. */
  maxSourceStaleSeconds: number
}

export const DEFAULT_KEEPER_CONFIG: KeeperConfig = { heartbeatSeconds: 6 * 3600, deviationBps: 50, maxSourceStaleSeconds: 3 * 24 * 3600 }

export interface KeeperDeps {
  readSource: FeedReader
  readTarget: FeedReader
  /** Kirim push(answer, updatedAt) ke target dan tunggu receipt sukses. */
  push(target: Address, answer: bigint, updatedAt: bigint): Promise<Hex>
  /** Waktu chain testnet (detik): round yang didorong memakai waktu ini agar urutan round dan verifikasi kontrak konsisten. */
  chainNowSec(): Promise<bigint>
  /** Waktu nyata (detik) untuk menilai kesegaran harga sumber di mainnet. */
  sourceNowSec(): bigint
  cfg: KeeperConfig
  mirrors: readonly MirrorFeed[]
}

export type MirrorAction = 'pushed' | 'fresh_enough' | 'source_stale' | 'source_error' | 'target_error' | 'decimals_mismatch' | 'push_failed'
export interface MirrorResult {
  symbol: string
  action: MirrorAction
  txHash?: Hex
  price?: string
}

export async function mirrorPrices(d: KeeperDeps): Promise<MirrorResult[]> {
  const out: MirrorResult[] = []
  const now = await d.chainNowSec()
  for (const m of d.mirrors) {
    let src
    try {
      src = await d.readSource(m.source)
    } catch {
      out.push({ symbol: m.symbol, action: 'source_error' })
      continue
    }
    if (src.answer <= 0n || d.sourceNowSec() - src.updatedAt > BigInt(d.cfg.maxSourceStaleSeconds)) {
      out.push({ symbol: m.symbol, action: 'source_stale' })
      continue
    }
    let tgt
    try {
      tgt = await d.readTarget(m.target)
    } catch {
      out.push({ symbol: m.symbol, action: 'target_error' })
      continue
    }
    if (tgt.decimals !== src.decimals) {
      out.push({ symbol: m.symbol, action: 'decimals_mismatch' })
      continue
    }
    const age = now - tgt.updatedAt
    const deviationBps = tgt.answer > 0n ? ((src.answer > tgt.answer ? src.answer - tgt.answer : tgt.answer - src.answer) * 10_000n) / tgt.answer : 10_000n
    const due = age >= BigInt(d.cfg.heartbeatSeconds) || deviationBps >= BigInt(d.cfg.deviationBps)
    if (!due) {
      out.push({ symbol: m.symbol, action: 'fresh_enough' })
      continue
    }
    try {
      const txHash = await d.push(m.target, src.answer, now)
      out.push({ symbol: m.symbol, action: 'pushed', txHash, price: src.answer.toString() })
    } catch {
      out.push({ symbol: m.symbol, action: 'push_failed' })
    }
  }
  return out
}
