import { describe, expect, it } from 'vitest'
import { CHAINS } from '@nexa-ai/shared'
import { resolvePaymentNetwork } from '../src/payment-network'

const TUSDG = '0x00000000000000000000000000000000000000ee'

describe('resolvePaymentNetwork', () => {
  it('default mainnet memakai USDG resmi dan RPC mainnet', () => {
    const n = resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 4663 })!
    expect(n.chainId).toBe(4663)
    expect(n.usdg).toBe(CHAINS.mainnet.usdg)
    expect(n.rpcUrl).toBe(CHAINS.mainnet.rpc)
    expect(n.chain).toEqual({ name: 'Robinhood Chain', rpcUrl: CHAINS.mainnet.rpc, explorerUrl: CHAINS.mainnet.explorer })
  })

  it('ASK_RPC_URL lama tetap dipakai di mainnet', () => {
    expect(resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 4663, ASK_RPC_URL: 'https://rpc.example.test' })!.rpcUrl).toBe('https://rpc.example.test')
  })

  it('mainnet menolak token selain USDG resmi (token uji tidak boleh lolos)', () => {
    expect(() => resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 4663, PAYMENT_USDG_ADDRESS: TUSDG })).toThrow(/USDG resmi/)
  })

  it('mainnet menerima alamat USDG resmi tanpa membedakan huruf besar-kecil', () => {
    const n = resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 4663, PAYMENT_USDG_ADDRESS: CHAINS.mainnet.usdg.toLowerCase() })!
    expect(n.usdg).toBe(CHAINS.mainnet.usdg)
  })

  it('testnet memakai token uji dari env dan RPC testnet; ASK_RPC_URL mainnet tidak terbawa', () => {
    const n = resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 46630, PAYMENT_USDG_ADDRESS: TUSDG, ASK_RPC_URL: CHAINS.mainnet.rpc })!
    expect(n.chainId).toBe(46630)
    expect(n.usdg).toBe(TUSDG)
    expect(n.rpcUrl).toBe(CHAINS.testnet.rpc)
    expect(n.chain.name).toBe(CHAINS.testnet.name)
  })

  it('testnet tanpa token uji = tidak aktif (503), bukan jatuh ke USDG mainnet', () => {
    expect(resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 46630 })).toBeUndefined()
  })

  it('chain tak dikenal ditolak', () => {
    expect(() => resolvePaymentNetwork({ PAYMENT_CHAIN_ID: 1 })).toThrow(/tidak dikenal/)
  })
})
