import type { AskResponse } from '@nexa-ai/api-client'

type Report = AskResponse['report']
export type Signal = Report['signals'][number]
export type RiskLevel = Report['riskLevel']

/** Ambang penilaian. Satu tempat supaya mudah ditinjau dan diubah; setiap ambang tercantum di catatan sinyal. */
export const THRESHOLDS = {
  creatorTaxWatchBps: 200,
  creatorTaxRiskBps: 500,
  topHolderWatchBps: 1000,
  topHolderRiskBps: 2000,
  top10WatchBps: 4000,
  top10RiskBps: 6000,
  thinTradersWatch: 10,
  thinTradersRisk: 3,
  sellPressureWatchPct: 90,
  creatorSellShareRiskPct: 30,
} as const

export interface SignalInput {
  creatorTaxBps: number | null
  topHolderShareBps: number | null
  top10ShareBps: number | null
  uniqueTraders: number
  tradesLast24h: number
  buyVolume: bigint
  sellVolume: bigint
  creatorSells: number
  creatorSellVolume: bigint
}

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`

/** Sinyal berbasis aturan tetap dari data indexer. Bukan prediksi dan bukan saran beli atau jual. */
export function buildSignals(i: SignalInput): Signal[] {
  const T = THRESHOLDS
  const out: Signal[] = []

  if (i.creatorTaxBps === null) {
    out.push({ id: 'creator_tax', label: 'Creator tax', value: 'unknown', level: 'unknown', note: 'The tax rate could not be read.' })
  } else {
    const level = i.creatorTaxBps > T.creatorTaxRiskBps ? 'risk' : i.creatorTaxBps > T.creatorTaxWatchBps ? 'watch' : 'ok'
    out.push({
      id: 'creator_tax',
      label: 'Creator tax',
      value: pct(i.creatorTaxBps),
      level,
      note: `Watch above ${pct(T.creatorTaxWatchBps)}, risk above ${pct(T.creatorTaxRiskBps)}.`,
    })
  }

  if (i.topHolderShareBps === null) {
    out.push({ id: 'top_holder', label: 'Largest holder', value: 'unknown', level: 'unknown', note: 'Holder history is incomplete.' })
  } else {
    const level = i.topHolderShareBps >= T.topHolderRiskBps ? 'risk' : i.topHolderShareBps >= T.topHolderWatchBps ? 'watch' : 'ok'
    out.push({
      id: 'top_holder',
      label: 'Largest holder',
      value: pct(i.topHolderShareBps),
      level,
      note: `Excludes the bonding curve and pool contracts. Watch from ${pct(T.topHolderWatchBps)}, risk from ${pct(T.topHolderRiskBps)}.`,
    })
  }

  if (i.top10ShareBps === null) {
    out.push({ id: 'top10', label: 'Top 10 holders', value: 'unknown', level: 'unknown', note: 'Holder history is incomplete.' })
  } else {
    const level = i.top10ShareBps >= T.top10RiskBps ? 'risk' : i.top10ShareBps >= T.top10WatchBps ? 'watch' : 'ok'
    out.push({
      id: 'top10',
      label: 'Top 10 holders',
      value: pct(i.top10ShareBps),
      level,
      note: `Combined share. Watch from ${pct(T.top10WatchBps)}, risk from ${pct(T.top10RiskBps)}.`,
    })
  }

  {
    const level = i.uniqueTraders < T.thinTradersRisk ? 'risk' : i.uniqueTraders < T.thinTradersWatch ? 'watch' : 'ok'
    out.push({
      id: 'participation',
      label: 'Unique traders',
      value: String(i.uniqueTraders),
      level,
      note: `Few distinct wallets means thin participation. Watch below ${T.thinTradersWatch}, risk below ${T.thinTradersRisk}.`,
    })
  }

  {
    const level = i.tradesLast24h === 0 ? 'watch' : 'ok'
    out.push({
      id: 'recent_activity',
      label: 'Trades in the last 24h',
      value: String(i.tradesLast24h),
      level,
      note: 'No trades in 24 hours means the market is inactive.',
    })
  }

  if (i.buyVolume > 0n) {
    const ratio = Number((i.sellVolume * 10_000n) / i.buyVolume) / 100
    const level = ratio >= T.sellPressureWatchPct ? 'watch' : 'ok'
    out.push({
      id: 'sell_pressure',
      label: 'Sell volume vs buy volume',
      value: `${ratio.toFixed(1)}%`,
      level,
      note: `Sell volume as a share of buy volume. Watch from ${T.sellPressureWatchPct}%.`,
    })
  } else {
    out.push({ id: 'sell_pressure', label: 'Sell volume vs buy volume', value: 'unknown', level: 'unknown', note: 'No buy volume recorded.' })
  }

  {
    const share = i.sellVolume > 0n ? Number((i.creatorSellVolume * 10_000n) / i.sellVolume) / 100 : 0
    const level = share >= T.creatorSellShareRiskPct ? 'risk' : i.creatorSells > 0 ? 'watch' : 'ok'
    out.push({
      id: 'creator_selling',
      label: 'Creator sells',
      value: `${i.creatorSells} (${share.toFixed(1)}% of sell volume)`,
      level,
      note: `Any sale by the creator wallet is a watch item. Risk from ${T.creatorSellShareRiskPct}% of all sell volume.`,
    })
  }

  return out
}

/** Satu angka ringkas dari sinyal: salah satu `risk` = high, salah satu `watch` = medium, banyak `unknown` = unknown. */
export function riskLevelOf(signals: Signal[]): RiskLevel {
  const unknown = signals.filter((s) => s.level === 'unknown').length
  if (signals.some((s) => s.level === 'risk')) return 'high'
  if (unknown >= Math.ceil(signals.length / 2)) return 'unknown'
  if (signals.some((s) => s.level === 'watch')) return 'medium'
  return 'low'
}
