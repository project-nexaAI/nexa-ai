import { and, count, eq } from 'drizzle-orm'
import { getAddress, parseAbi, parseEventLogs, type Hex, type PublicClient } from 'viem'
import { ponsTokens, ponsTrades } from '@nexa-ai/db'
import type { AskResponse } from '@nexa-ai/api-client'
import type { Db } from './app'

const erc20Transfer = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

export interface AskConfig {
  client: Pick<PublicClient, 'getTransactionReceipt'>
  usdg: `0x${string}`
  /** Penerima pembayaran (env ASK_PAYMENT_RECIPIENT, default TREASURY_ADDRESS). */
  recipient: `0x${string}`
  /** Harga minimum dalam unit terkecil USDG (6 desimal): 1_000_000 = $1. */
  minAmount: bigint
}

export type PaymentCheck = { ok: true; payer: string; amount: bigint } | { ok: false; reason: 'tx_not_found' | 'tx_failed' | 'no_payment' | 'underpaid' }

/** Pembayaran sah = transfer USDG ke penerima di tx yang sukses, nilai >= harga. Dicek SEBELUM LLM/analisis. */
export async function verifyUsdgPayment(cfg: AskConfig, txHash: Hex): Promise<PaymentCheck> {
  let receipt
  try {
    receipt = await cfg.client.getTransactionReceipt({ hash: txHash })
  } catch {
    return { ok: false, reason: 'tx_not_found' }
  }
  if (receipt.status !== 'success') return { ok: false, reason: 'tx_failed' }
  const transfers = parseEventLogs({ abi: erc20Transfer, logs: receipt.logs, eventName: 'Transfer' }).filter(
    (l) => l.address.toLowerCase() === cfg.usdg.toLowerCase() && l.args.to.toLowerCase() === cfg.recipient.toLowerCase(),
  )
  if (transfers.length === 0) return { ok: false, reason: 'no_payment' }
  const amount = transfers.reduce((a, l) => a + l.args.value, 0n)
  if (amount < cfg.minAmount) return { ok: false, reason: 'underpaid' }
  return { ok: true, payer: getAddress(transfers[0]!.args.from), amount }
}

export const ASK_DISCLAIMER = 'Ringkasan data on-chain otomatis. Bukan nasihat keuangan.'
const MIN_AGE_SECONDS = 3600

export type ReportResult = { kind: 'report'; report: AskResponse['report'] } | { kind: 'too_new' | 'no_data' }

/** Laporan hanya dari data indexer. Token < 1 jam tidak dibahas (aturan RiskGuard); tanpa data = "tidak tahu". */
export async function buildRiskReport(db: Db, address: string, now: Date): Promise<ReportResult> {
  const [t] = await db.select().from(ponsTokens).where(eq(ponsTokens.address, getAddress(address)))
  if (!t) return { kind: 'no_data' }
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - t.launchedAt.getTime()) / 1000))
  if (ageSeconds < MIN_AGE_SECONDS) return { kind: 'too_new' }
  const side = async (s: 'buy' | 'sell') =>
    Number((await db.select({ n: count() }).from(ponsTrades).where(and(eq(ponsTrades.token, t.address), eq(ponsTrades.side, s))))[0]!.n)
  const [buys, sells] = await Promise.all([side('buy'), side('sell')])
  const unknowns: string[] = []
  if (t.creatorTaxBps === null) unknowns.push('creator tax tidak terbaca')
  if (t.topHolderShareBps === null) unknowns.push('konsentrasi holder belum dianalisis')
  return {
    kind: 'report',
    report: {
      name: t.name,
      symbol: t.symbol,
      ageSeconds,
      graduated: t.graduatedAt !== null,
      creatorTaxBps: t.creatorTaxBps,
      topHolderShareBps: t.topHolderShareBps,
      trades: { total: buys + sells, buys, sells },
      redFlags: t.redFlags,
      unknowns,
      disclaimer: ASK_DISCLAIMER,
    },
  }
}
