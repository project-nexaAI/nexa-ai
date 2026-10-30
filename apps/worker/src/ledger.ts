import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { nexaLedgerAbi } from '@nexa-ai/contracts-abi'

const aggregatorAbi = parseAbi([
  'function getRoundData(uint80) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

export interface LedgerConfig {
  rpcUrl: string
  chainId: number
  ledgerAddress: Address
  /** Kunci wallet agent. Hanya dibaca dari env di proses worker; tidak pernah di-log. */
  agentPrivateKey: Hex
}

export interface RoundPick {
  startRoundId: bigint
  endRoundId: bigint
}

export interface RevealResult extends RoundPick {
  txHash: Hex
  won: boolean
  returnBps: bigint
}

const MAX_ROUND_SCAN = 10_000

export function createLedgerClient(cfg: LedgerConfig) {
  const chain = defineChain({
    id: cfg.chainId,
    name: `chain-${cfg.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  })
  const account = privateKeyToAccount(cfg.agentPrivateKey)
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) })
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) })
  const address = cfg.ledgerAddress

  async function roundAt(feed: Address, id: bigint): Promise<{ price: bigint; updatedAt: bigint } | null> {
    try {
      const r = await pub.readContract({ address: feed, abi: aggregatorAbi, functionName: 'getRoundData', args: [id] })
      return r[3] === 0n ? null : { price: r[1], updatedAt: r[3] }
    } catch {
      return null
    }
  }

  return {
    agentAddress: account.address,

    /** Waktu chain (detik, UTC) dari blok terbaru. */
    async chainTime(): Promise<bigint> {
      return (await pub.getBlock()).timestamp
    },

    async feedOf(asset: Address): Promise<Address> {
      return pub.readContract({ address, abi: nexaLedgerAbi, functionName: 'feedOf', args: [asset] })
    },

    /** commit(hash): menunggu receipt sukses; baru setelah itu boleh diposting. */
    async commit(hash: Hex): Promise<{ ledgerId: number; txHash: Hex; committedAt: bigint }> {
      const txHash = await wallet.writeContract({ address, abi: nexaLedgerAbi, functionName: 'commit', args: [hash] })
      const receipt = await pub.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') throw new Error(`commit gagal (tx ${txHash})`)
      const [ev] = parseEventLogs({ abi: nexaLedgerAbi, logs: receipt.logs, eventName: 'Committed' })
      if (!ev) throw new Error(`event Committed tidak ditemukan (tx ${txHash})`)
      return { ledgerId: Number(ev.args.id), txHash, committedAt: BigInt(ev.args.committedAt) }
    },

    /**
     * Round awal = round terakhir dengan updatedAt <= waktu commit; round akhir = round pertama dengan
     * updatedAt >= jatuh tempo. Kontrak memverifikasi ulang keduanya.
     */
    async findRounds(feed: Address, committedAt: bigint, maturity: bigint): Promise<RoundPick> {
      const latest = await pub.readContract({ address: feed, abi: aggregatorAbi, functionName: 'latestRoundData' })
      if (latest[3] < maturity) throw new Error('belum ada round oracle setelah jatuh tempo')

      let end = latest[0]
      for (let i = 0; i < MAX_ROUND_SCAN; i++) {
        const prev = await roundAt(feed, end - 1n)
        if (prev && prev.updatedAt >= maturity) end -= 1n
        else break
      }

      let start = end
      for (let i = 0; i < MAX_ROUND_SCAN; i++) {
        const r = await roundAt(feed, start)
        if (!r) throw new Error('round awal tidak ditemukan')
        if (r.updatedAt <= committedAt) return { startRoundId: start, endRoundId: end }
        start -= 1n
      }
      throw new Error('round awal tidak ditemukan dalam batas pemindaian')
    },

    async reveal(p: {
      ledgerId: number
      text: string
      asset: Address
      direction: number
      horizon: number
      salt: Hex
      startRoundId: bigint
      endRoundId: bigint
    }): Promise<RevealResult> {
      const txHash = await wallet.writeContract({
        address,
        abi: nexaLedgerAbi,
        functionName: 'reveal',
        args: [BigInt(p.ledgerId), p.text, p.asset, p.direction, p.horizon, p.salt, p.startRoundId, p.endRoundId],
      })
      const receipt = await pub.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') throw new Error(`reveal gagal (tx ${txHash})`)
      const [ev] = parseEventLogs({ abi: nexaLedgerAbi, logs: receipt.logs, eventName: 'Revealed' })
      if (!ev) throw new Error(`event Revealed tidak ditemukan (tx ${txHash})`)
      return {
        txHash,
        won: ev.args.won,
        returnBps: ev.args.returnBps,
        startRoundId: p.startRoundId,
        endRoundId: p.endRoundId,
      }
    },
  }
}

export type LedgerClient = ReturnType<typeof createLedgerClient>
