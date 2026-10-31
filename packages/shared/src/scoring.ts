import { DIRECTION, type Direction } from './commit-reveal'

export interface CallScore {
  /** Perubahan harga mentah dalam bps (negatif jika turun); pembagian bulat ke nol, sama dengan Solidity. */
  returnBps: number
  won: boolean
}

/**
 * Aturan skor yang sama dengan NexaLedger.reveal: naik menang bila return > 0 dan >= minMoveBps,
 * turun menang bila return < 0 dan -return >= minMoveBps. Harga bigint dengan desimal yang sama.
 */
export function scoreCall(p: { direction: Direction; startPrice: bigint; endPrice: bigint; minMoveBps?: number }): CallScore {
  if (p.startPrice <= 0n) throw new Error('harga awal harus positif')
  const ret = Number(((p.endPrice - p.startPrice) * 10_000n) / p.startPrice)
  const min = p.minMoveBps ?? 0
  const won = p.direction === DIRECTION.UP ? ret > 0 && ret >= min : ret < 0 && -ret >= min
  return { returnBps: ret, won }
}
