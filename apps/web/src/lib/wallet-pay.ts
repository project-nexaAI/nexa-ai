import { encodeFunctionData, getAddress, parseAbi } from 'viem'

export type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }

/** Bagian dari /pro/plan dan /ask/plan yang dibutuhkan untuk membayar USDG dari wallet. */
export interface PaymentPlan {
  price: { raw: string }
  recipient: string
  usdgAddress: string
  chainId: number
  chain?: { name: string; rpcUrl: string; explorerUrl: string } | undefined
}

const erc20 = parseAbi(['function transfer(address to, uint256 value) returns (bool)'])
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** MetaMask menjawab 4902 untuk chain yang belum ditambahkan; sebagian versi membungkusnya (-32603 + data.originalError). */
export function isUnknownChain(err: unknown): boolean {
  const e = err as { code?: number; data?: { originalError?: { code?: number } } } | null
  return e?.code === 4902 || e?.data?.originalError?.code === 4902 || (e?.code === -32603 && /unrecognized chain|not been added/i.test(String((err as Error).message)))
}

/** Pesan untuk galat wallet yang dikenali; null bila tidak dikenali (pemanggil memakai pesan umum). */
export function walletMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : ''
  const code = (err as { code?: number } | null)?.code
  if (/insufficient funds|exceeds balance/i.test(msg)) return 'Your wallet does not have enough USDG or ETH (for gas) on this network.'
  if (msg === 'no-wallet') return 'No browser wallet found. Install a wallet such as MetaMask, then reload.'
  if (msg === 'wrong-account') return 'Your wallet is on a different account than the one you signed in with. Switch accounts, then try again.'
  if (code === 4001 || /rejected|denied/i.test(msg)) return 'The wallet request was closed. Nothing was sent.'
  if (isUnknownChain(err)) return 'Your wallet does not know this network yet. Add it in your wallet, then try again.'
  return null
}

export const PAYMENT_FAILED = 'The payment transaction failed on-chain. Nothing was charged.'

/**
 * Bayar `plan.price` dalam USDG ke `plan.recipient` dari wallet browser: sambungkan akun, pindah (atau tambahkan) jaringan,
 * kirim transfer, lalu tunggu konfirmasi sampai ~2 menit. `confirmed: false` = tx terkirim tapi belum terkonfirmasi.
 * `expectFrom` (opsional) = akun yang wajib dipakai wallet, mis. akun yang login.
 */
export async function sendUsdgPayment(plan: PaymentPlan, expectFrom?: string, onSent?: (hash: string) => void): Promise<{ hash: string; confirmed: boolean }> {
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
  if (!eth) throw new Error('no-wallet')
  const [from] = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  if (expectFrom && getAddress(from!) !== getAddress(expectFrom)) throw new Error('wrong-account')
  const chainHex = `0x${plan.chainId.toString(16)}`
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] })
  } catch (err) {
    // Wallet belum mengenal jaringan ini: minta wallet menambahkannya (MetaMask menampilkan konfirmasi), lalu lanjut.
    if (!plan.chain || !isUnknownChain(err)) throw err
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainHex,
          chainName: plan.chain.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [plan.chain.rpcUrl],
          blockExplorerUrls: [plan.chain.explorerUrl],
        },
      ],
    })
  }
  const data = encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [getAddress(plan.recipient), BigInt(plan.price.raw)] })
  const hash = (await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: plan.usdgAddress, data }] })) as string
  onSent?.(hash)
  for (let i = 0; i < 60; i++) {
    const receipt = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as { status?: string } | null
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error(PAYMENT_FAILED)
      return { hash, confirmed: true }
    }
    await sleep(2000)
  }
  return { hash, confirmed: false }
}
