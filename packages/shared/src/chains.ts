// Sumber: diverifikasi lewat eth_chainId / eth_getCode pada 2026-10-30.
// Alamat bernilai null BELUM terverifikasi: jangan diisi dengan tebakan.
export interface ChainConfig {
  readonly id: number
  readonly name: string
  readonly rpc: string
  readonly explorer: string
  readonly faucet: string | null
  readonly pons: { readonly factory: `0x${string}` | null; readonly hook: `0x${string}` | null; readonly graduationExecutor: `0x${string}` | null }
  readonly chainlink: { readonly ethUsd: `0x${string}` | null; readonly nvdaUsd: `0x${string}` | null }
  readonly usdg: `0x${string}` | null
  readonly uniswapV4: { readonly poolManager: `0x${string}` | null }
}

const unknownAddrs = {
  chainlink: { ethUsd: null, nvdaUsd: null },
  usdg: null,
  uniswapV4: { poolManager: null },
} as const

export const CHAINS = {
  testnet: {
    id: 46630, // eth_chainId = 0xb626 (cocok dengan brief)
    name: 'Robinhood Chain Testnet',
    rpc: 'https://rpc.testnet.chain.robinhood.com',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    faucet: 'https://faucet.testnet.chain.robinhood.com',
    // Factory contoh dari brief (Bitquery) tidak punya code di testnet.
    pons: { factory: null, hook: null, graduationExecutor: null },
    ...unknownAddrs,
  },
  mainnet: {
    id: 4663, // eth_chainId = 0x1237
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    faucet: null,
    // Factory dari brief punya code di mainnet; TETAP wajib diverifikasi ke dokumen resmi Pons.
    pons: { factory: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e', hook: null, graduationExecutor: null },
    ...unknownAddrs,
  },
} as const satisfies Record<string, ChainConfig>

export type NetworkName = keyof typeof CHAINS
