import { CHAINS } from '@nexa-ai/shared'

export interface PaymentNetwork {
  chainId: number
  usdg: `0x${string}`
  rpcUrl: string
  /** Data jaringan untuk wallet_addEthereumChain di web. */
  chain: { name: string; rpcUrl: string; explorerUrl: string }
}

export interface PaymentNetworkEnv {
  PAYMENT_CHAIN_ID: number
  PAYMENT_USDG_ADDRESS?: string | undefined
  PAYMENT_RPC_URL?: string | undefined
  /** Nama lama untuk RPC pembayaran mainnet; dipakai hanya di mainnet. */
  ASK_RPC_URL?: string | undefined
}

/**
 * Jaringan tempat Ask NEXA dan Pro dibayar. Default dan jalur produksi: mainnet 4663 dengan USDG resmi dari chains.ts.
 * Testnet 46630 hanya untuk uji dan wajib memakai alamat token uji eksplisit. Di mainnet, alamat selain USDG resmi
 * ditolak saat start, supaya token tiruan tidak pernah bisa dianggap pembayaran sah.
 * Mengembalikan undefined bila USDG belum diketahui (fitur menjawab 503).
 */
export function resolvePaymentNetwork(env: PaymentNetworkEnv): PaymentNetwork | undefined {
  const net = Object.values(CHAINS).find((c) => c.id === env.PAYMENT_CHAIN_ID)
  if (!net) throw new Error(`PAYMENT_CHAIN_ID ${env.PAYMENT_CHAIN_ID} tidak dikenal (pakai ${CHAINS.mainnet.id} atau ${CHAINS.testnet.id})`)
  const isMainnet = net.id === CHAINS.mainnet.id
  const configured = env.PAYMENT_USDG_ADDRESS as `0x${string}` | undefined
  if (isMainnet && configured && configured.toLowerCase() !== CHAINS.mainnet.usdg.toLowerCase()) {
    throw new Error('PAYMENT_USDG_ADDRESS di mainnet harus USDG resmi; kosongkan variabel ini')
  }
  const usdg = isMainnet ? CHAINS.mainnet.usdg : configured
  if (!usdg) return undefined
  return {
    chainId: net.id,
    usdg,
    rpcUrl: env.PAYMENT_RPC_URL ?? (isMainnet ? env.ASK_RPC_URL : undefined) ?? net.rpc,
    chain: { name: net.name, rpcUrl: net.rpc, explorerUrl: net.explorer },
  }
}
