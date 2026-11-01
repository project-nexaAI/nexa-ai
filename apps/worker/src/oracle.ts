import { createPublicClient, formatUnits, http, parseAbi, type Address } from 'viem'
import { CHAINS, type NetworkName } from '@nexa-ai/shared'
import type { PredictionCandidate } from '../prompts/persona'

const feedAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

export interface OracleAsset {
  symbol: string
  /** Aset yang dicatat di NexaLedger (feedOf(asset) harus menunjuk ke feed ini). */
  asset: Address
  feed: Address
}

/** Aset mainnet: NVDA Stock Token (api.robinhood.com/rhj/assets) dan WETH (docs.robinhood.com/chain/contracts). */
export const MAINNET_ORACLE_ASSETS: readonly OracleAsset[] = [
  {
    symbol: 'NVDA',
    asset: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    feed: CHAINS.mainnet.chainlink.nvdaUsd,
  },
  {
    symbol: 'ETH',
    asset: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    feed: CHAINS.mainnet.chainlink.ethUsd,
  },
]

export interface FeedReading {
  answer: bigint
  decimals: number
  updatedAt: bigint
}

export type FeedReader = (feed: Address) => Promise<FeedReading>

export function createFeedReader(rpcUrl: string): FeedReader {
  const pub = createPublicClient({ transport: http(rpcUrl) })
  return async (feed) => {
    const [decimals, round] = await Promise.all([
      pub.readContract({ address: feed, abi: feedAbi, functionName: 'decimals' }),
      pub.readContract({ address: feed, abi: feedAbi, functionName: 'latestRoundData' }),
    ])
    return { answer: round[1], decimals, updatedAt: round[3] }
  }
}

/** Heartbeat feed Chainlink Robinhood 24 jam; saham tutup akhir pekan, jadi toleransi 3 hari. */
export const DEFAULT_MAX_STALE_SECONDS = 3 * 24 * 3600

/** Harga USD dengan 2 desimal dari nilai bigint + desimal eksplisit (tanpa float). */
export function formatUsd(answer: bigint, decimals: number): string {
  const s = formatUnits(answer, decimals)
  const [whole, frac = ''] = s.split('.')
  return `${whole}.${frac.padEnd(2, '0').slice(0, 2)}`
}

/**
 * Kandidat prediksi dari oracle. Feed yang gagal dibaca, harganya tidak positif, atau basi dibuang
 * (bukan ditebak); hasil kosong membuat siklus menjawab "tidak ada prediksi hari ini".
 */
export async function readOracleCandidates(
  read: FeedReader,
  assets: readonly OracleAsset[],
  nowSeconds: bigint,
  maxStaleSeconds = DEFAULT_MAX_STALE_SECONDS,
): Promise<PredictionCandidate[]> {
  const out: PredictionCandidate[] = []
  for (const a of assets) {
    if (a.feed === null) continue
    try {
      const r = await read(a.feed)
      if (r.answer <= 0n || r.updatedAt === 0n) continue
      if (nowSeconds - r.updatedAt > BigInt(maxStaleSeconds)) continue
      out.push({ symbol: a.symbol, asset: a.asset, oraclePrice: `$${formatUsd(r.answer, r.decimals)}` })
    } catch {
      continue
    }
  }
  return out
}

export const oracleAssetsFor = (network: NetworkName): readonly OracleAsset[] => (network === 'mainnet' ? MAINNET_ORACLE_ASSETS : [])

// ------------------------------------------------------------- riwayat harga

const roundAbi = parseAbi([
  'function getRoundData(uint80 roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

export interface RoundInfo {
  roundId: bigint
  answer: bigint
  updatedAt: bigint
}

export interface FeedHistory {
  /** Round terbaru. */
  latest(feed: Address): Promise<RoundInfo & { decimals: number }>
  /** Round tertentu; null bila tidak ada (di luar riwayat atau lintas fase). */
  round(feed: Address, roundId: bigint): Promise<RoundInfo | null>
}

export function createFeedHistory(rpcUrl: string): FeedHistory {
  const pub = createPublicClient({ transport: http(rpcUrl) })
  return {
    async latest(feed) {
      const [decimals, r] = await Promise.all([
        pub.readContract({ address: feed, abi: feedAbi, functionName: 'decimals' }),
        pub.readContract({ address: feed, abi: feedAbi, functionName: 'latestRoundData' }),
      ])
      return { roundId: r[0], answer: r[1], updatedAt: r[3], decimals }
    },
    async round(feed, roundId) {
      try {
        const r = await pub.readContract({ address: feed, abi: roundAbi, functionName: 'getRoundData', args: [roundId] })
        return { roundId: r[0], answer: r[1], updatedAt: r[3] }
      } catch {
        return null
      }
    },
  }
}

export interface PriceChange {
  /** Perubahan harga dalam bps (bilangan bulat, dibulatkan ke nol). */
  changeBps: number
  /** Selang waktu sebenarnya antara dua round yang dibandingkan, dalam jam bulat. */
  windowHours: number
}

/**
 * Perubahan harga dari round terakhir yang diperbarui paling lambat `windowSeconds` sebelum round terbaru.
 * Dihitung dari bigint (tanpa float). Null (tidak ditebak) bila riwayat tidak cukup, harga tidak positif,
 * atau selang sebenarnya lebih dari 2x `windowSeconds` (mis. feed jarang diperbarui).
 */
export async function priceChange(h: FeedHistory, feed: Address, windowSeconds = 24 * 3600, maxSteps = 60): Promise<PriceChange | null> {
  try {
    const latest = await h.latest(feed)
    if (latest.answer <= 0n) return null
    const target = latest.updatedAt - BigInt(windowSeconds)
    let id = latest.roundId
    for (let i = 0; i < maxSteps; i++) {
      id -= 1n
      const r = await h.round(feed, id)
      if (!r || r.answer <= 0n) return null
      if (r.updatedAt <= target) {
        const span = latest.updatedAt - r.updatedAt
        if (span > BigInt(windowSeconds) * 2n) return null
        return { changeBps: Number(((latest.answer - r.answer) * 10_000n) / r.answer), windowHours: Math.max(1, Math.round(Number(span) / 3600)) }
      }
    }
    return null
  } catch {
    return null
  }
}

/** "35" -> "0.35"; "-120" -> "-1.20". Persen dari bps tanpa float. */
export function bpsToPercent(bps: number): string {
  const sign = bps < 0 ? '-' : ''
  const abs = Math.abs(bps)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
