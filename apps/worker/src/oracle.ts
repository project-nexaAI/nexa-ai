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
