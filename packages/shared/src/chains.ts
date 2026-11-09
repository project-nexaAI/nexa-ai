// Sumber: diverifikasi lewat eth_chainId / eth_getCode pada 2026-10-30; alamat mainnet diperbarui 2026-10-31.
// NVDA Stock Token mainnet: 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC (api.robinhood.com/rhj/assets, 18 desimal);
// sengaja tidak di sini karena aset pasangan adalah parameter deploy, bukan hardcode.
// Alamat bernilai null BELUM terverifikasi: jangan diisi dengan tebakan.
export interface ChainConfig {
  readonly id: number
  readonly name: string
  readonly rpc: string
  /** Basis URL explorer, tanpa slash akhir (mis. https://robinhoodchain.blockscout.com). */
  readonly explorer: string
  /** Path separator antara basis explorer dan hash/alamat transaksi. '/tx/' untuk Robinhood; '/transaction/' untuk Elysium. */
  readonly explorerTxPath: string
  readonly faucet: string | null
  readonly nativeCurrency: { readonly symbol: string; readonly name: string; readonly decimals: number }
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
const nativeEth = { symbol: 'ETH', name: 'Ether', decimals: 18 } as const

export const CHAINS = {
  testnet: {
    id: 46630, // eth_chainId = 0xb626 (cocok dengan brief)
    name: 'Robinhood Chain Testnet',
    rpc: 'https://rpc.testnet.chain.robinhood.com',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    explorerTxPath: '/tx/',
    faucet: 'https://faucet.testnet.chain.robinhood.com',
    nativeCurrency: nativeEth,
    // Factory contoh dari brief (Bitquery) tidak punya code di testnet.
    pons: { factory: null, hook: null, graduationExecutor: null },
    ...unknownAddrs,
  },
  mainnet: {
    id: 4663, // eth_chainId = 0x1237
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    explorerTxPath: '/tx/',
    faucet: null,
    nativeCurrency: nativeEth,
    // Pons V2: docs.ponsfamily.com/v2; hook.factory() on-chain = factory ini. Semua punya code (cast code, 2026-10-31).
    pons: {
      factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
      hook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
      graduationExecutor: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046',
    },
    // Chainlink: reference-data-directory (daftar resmi docs.chain.link), description()/decimals() dicek on-chain.
    chainlink: {
      ethUsd: '0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9',
      nvdaUsd: '0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15',
    },
    // USDG (6 desimal): docs.robinhood.com/chain/contracts. PoolManager: hook.poolManager() on-chain (belum ada di docs Robinhood).
    usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    uniswapV4: { poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951' },
  },
  // Elysium testnet (Arbitrum Nitro, gas: HYPE). Sumber: elysium.kinetiq.xyz/docs, dibaca 2026-11-09.
  // PERINGATAN: elysiumTestnet bawaan viem adalah chain 1338 (Vulcan Forged, token LAVA) — BUKAN ini.
  // Gunakan defineChain(CHAINS.elysiumTestnet) agar tidak tertukar.
  elysiumTestnet: {
    id: 99801, // 0x185d9; parent: HyperEVM testnet (998)
    name: 'Elysium Testnet',
    rpc: 'https://testnet-rpc.elysium.kinetiq.xyz',
    explorer: 'https://elysium.kinetiq.xyz/testnet-explorer',
    // Format explorer berbeda: /transaction/<hash> (bukan /tx/), /address/<addr> sama
    explorerTxPath: '/transaction/',
    faucet: 'https://elysium.kinetiq.xyz/testnet-faucet',
    nativeCurrency: { symbol: 'HYPE', name: 'HYPE', decimals: 18 },
    // Launchpad Elysium (Pump.fun, Ascend, Montra): alamat belum dikonfirmasi (BLOCKERS #E7)
    pons: { factory: null, hook: null, graduationExecutor: null },
    // Tidak ada Chainlink di Elysium; memakai MockV3Aggregator + keeper harga
    ...unknownAddrs,
  },
} as const satisfies Record<string, ChainConfig>

export type NetworkName = keyof typeof CHAINS

// ── Helpers ──────────────────────────────────────────────────────────────────

/** chainId → slug API. Slug dipakai di ?chain= param dan env CHAIN_SLUG. */
export const CHAIN_ID_TO_SLUG: Readonly<Record<number, string>> = {
  4663: 'robinhood',
  46630: 'robinhood',  // service testnet tetap melayani slug 'robinhood' supaya ?chain=robinhood jalan di testnet
  99801: 'elysium-testnet',
}

/** Slug chain untuk chainId; fallback ke 'robinhood'. */
export function chainSlug(chainId: number): string {
  return CHAIN_ID_TO_SLUG[chainId] ?? 'robinhood'
}

/** URL lengkap transaksi di explorer chain (format tiap chain berbeda). */
export function explorerTxUrl(chain: ChainConfig, hash: string): string {
  return `${chain.explorer}${chain.explorerTxPath}${hash}`
}

/** URL lengkap halaman alamat kontrak di explorer chain. */
export function explorerAddrUrl(chain: ChainConfig, address: string): string {
  return `${chain.explorer}/address/${address}`
}
