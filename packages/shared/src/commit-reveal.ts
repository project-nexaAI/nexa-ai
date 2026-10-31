import { encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hex } from 'viem'

export const DIRECTION = { UP: 1, DOWN: 2 } as const
export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION]

export interface PredictionPreimage {
  text: string
  asset: Address
  direction: Direction
  /** detik */
  horizon: number
  /** bytes32, dirahasiakan sampai reveal */
  salt: Hex
}

/**
 * keccak256(abi.encode(string text, address asset, uint8 direction, uint32 horizon, bytes32 salt))
 * Harus identik dengan `NexaLedger.computeHash`.
 */
export function computePredictionHash(p: PredictionPreimage): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('string, address, uint8, uint32, bytes32'), [
      p.text,
      p.asset,
      p.direction,
      p.horizon,
      p.salt,
    ]),
  )
}
