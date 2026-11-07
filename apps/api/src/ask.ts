import { and, desc, eq, sql } from 'drizzle-orm'
import { getAddress, parseAbi, parseEventLogs, type Hex, type PublicClient } from 'viem'
import { ponsTokens, ponsTrades, tokenHolders } from '@nexa-ai/db'
import type { AskResponse } from '@nexa-ai/api-client'
import type { Db } from './app'
import { buildSignals, riskLevelOf } from './ask-signals'
import { formatUnits } from './format'

const erc20Transfer = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

export interface AskConfig {
  client: Pick<PublicClient, 'getTransactionReceipt'>
  usdg: `0x${string}`
  /** Penerima pembayaran (env ASK_PAYMENT_RECIPIENT, default TREASURY_ADDRESS). */
  recipient: `0x${string}`
  /** Harga minimum dalam unit terkecil USDG (6 desimal): 1_000_000 = $1. */
  minAmount: bigint
  /** Chain pembayaran dan datanya untuk menambahkan jaringan di wallet (hanya untuk GET /ask/plan). */
  chainId?: number
  chain?: { name: string; rpcUrl: string; explorerUrl: string }
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

export const ASK_DISCLAIMER = 'Automated summary of on-chain data. Not financial advice.'
const MIN_AGE_SECONDS = 3600

export type ReportResult = { kind: 'report'; report: AskResponse['report'] } | { kind: 'too_new' | 'no_data' }

export interface ReportOptions {
  /** Basis Blockscout untuk alamat (default: Robinhood Chain mainnet). */
  explorerBase?: string
  /** Alamat yang bukan holder sungguhan (kontrak pool, hook, factory). Kurva token dan alamat nol selalu dikecualikan. */
  excludedHolders?: readonly string[]
}

const ZERO = '0x0000000000000000000000000000000000000000'
const DEFAULT_EXPLORER = 'https://robinhoodchain.blockscout.com'
/** Aset pasangan yang dikenal (mainnet). Alamat lain tampil tanpa simbol. */
const PAIR_SYMBOLS: Record<string, string> = {
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168': 'USDG',
  '0x0bd7d308f8e1639fab988df18a8011f41eacad73': 'WETH',
  '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec': 'NVDA',
}

const signed = (v: bigint, decimals: number) => (v < 0n ? `-${formatUnits(-v, decimals)}` : formatUnits(v, decimals))
const toIso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)

/** Laporan hanya dari data indexer. Token < 1 jam tidak dibahas (aturan RiskGuard); tanpa data = "tidak tahu". */
export async function buildRiskReport(db: Db, address: string, now: Date, opts: ReportOptions = {}): Promise<ReportResult> {
  const [t] = await db.select().from(ponsTokens).where(eq(ponsTokens.address, getAddress(address)))
  if (!t) return { kind: 'no_data' }
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - t.launchedAt.getTime()) / 1000))
  if (ageSeconds < MIN_AGE_SECONDS) return { kind: 'too_new' }

  const base = (opts.explorerBase ?? DEFAULT_EXPLORER).replace(/\/$/, '')
  const link = (a: string) => `${base}/address/${a}`
  const since1h = new Date(now.getTime() - 3_600_000).toISOString()
  const since24h = new Date(now.getTime() - 86_400_000).toISOString()
  const forToken = eq(ponsTrades.token, t.address)

  const [bySide, [overall], [largest], [creator]] = await Promise.all([
    db
      .select({
        side: ponsTrades.side,
        n: sql<number>`count(*)::int`,
        traders: sql<number>`count(distinct ${ponsTrades.trader})::int`,
        vol: sql<string>`coalesce(sum(${ponsTrades.quoteAmount}), 0)::text`,
        dec: sql<number | null>`max(${ponsTrades.quoteDecimals})`,
      })
      .from(ponsTrades)
      .where(forToken)
      .groupBy(ponsTrades.side),
    db
      .select({
        traders: sql<number>`count(distinct ${ponsTrades.trader})::int`,
        h1: sql<number>`count(*) filter (where ${ponsTrades.at} >= ${since1h}::timestamptz)::int`,
        h24: sql<number>`count(*) filter (where ${ponsTrades.at} >= ${since24h}::timestamptz)::int`,
        first: sql<Date | null>`min(${ponsTrades.at})`,
        last: sql<Date | null>`max(${ponsTrades.at})`,
      })
      .from(ponsTrades)
      .where(forToken),
    db.select().from(ponsTrades).where(forToken).orderBy(desc(ponsTrades.quoteAmount)).limit(1),
    db
      .select({
        buys: sql<number>`count(*) filter (where ${ponsTrades.side} = 'buy')::int`,
        sells: sql<number>`count(*) filter (where ${ponsTrades.side} = 'sell')::int`,
        sold: sql<string>`coalesce(sum(${ponsTrades.quoteAmount}) filter (where ${ponsTrades.side} = 'sell'), 0)::text`,
      })
      .from(ponsTrades)
      .where(and(forToken, sql`lower(${ponsTrades.trader}) = lower(${t.creator})`)),
  ])
  const buy = bySide.find((r) => r.side === 'buy')
  const sell = bySide.find((r) => r.side === 'sell')
  const buys = buy?.n ?? 0
  const sells = sell?.n ?? 0
  const decimals = buy?.dec ?? sell?.dec ?? null
  const dec = decimals ?? 18
  const buyVol = BigInt(buy?.vol ?? '0')
  const sellVol = BigInt(sell?.vol ?? '0')
  const creatorSold = BigInt(creator?.sold ?? '0')

  // Holder: sama dengan penghitungan indexer (total = jumlah saldo; kurva dan kontrak pool dikecualikan dari peringkat).
  const hs = await db.select().from(tokenHolders).where(eq(tokenHolders.token, t.address)).orderBy(desc(tokenHolders.balance)).limit(60)
  const [agg] = await db
    .select({
      total: sql<string>`coalesce(sum(${tokenHolders.balance}), 0)::text`,
      positive: sql<number>`count(*) filter (where ${tokenHolders.balance} > 0)::int`,
      negative: sql<number>`count(*) filter (where ${tokenHolders.balance} < 0)::int`,
    })
    .from(tokenHolders)
    .where(eq(tokenHolders.token, t.address))
  const total = BigInt(agg?.total ?? '0')
  const excluded = new Set([ZERO, (t.curve ?? '').toLowerCase(), ...(opts.excludedHolders ?? []).map((a) => a.toLowerCase())])
  let holders: AskResponse['report']['details']['holders'] = null
  if ((agg?.negative ?? 0) === 0 && total > 0n) {
    const ranked = hs.filter((h) => !excluded.has(h.holder.toLowerCase())).map((h) => ({ holder: h.holder, bal: BigInt(h.balance) }))
    const bps = (v: bigint) => Number((v * 10_000n) / total)
    const sum = (n: number) => ranked.slice(0, n).reduce((a, r) => a + r.bal, 0n)
    holders = {
      count: agg?.positive ?? 0,
      top5ShareBps: bps(sum(5)),
      top10ShareBps: bps(sum(10)),
      top: ranked.slice(0, 10).map((r) => ({ address: r.holder, url: link(r.holder), shareBps: bps(r.bal) })),
    }
  }

  const unknowns: string[] = []
  if (t.creatorTaxBps === null) unknowns.push('creator tax could not be read')
  if (t.topHolderShareBps === null) unknowns.push('holder concentration not analyzed yet')
  if (decimals === null) unknowns.push('no trade volume recorded')

  const signals = buildSignals({
    creatorTaxBps: t.creatorTaxBps,
    topHolderShareBps: t.topHolderShareBps,
    top10ShareBps: holders?.top10ShareBps ?? null,
    uniqueTraders: overall?.traders ?? 0,
    tradesLast24h: overall?.h24 ?? 0,
    buyVolume: buyVol,
    sellVolume: sellVol,
    creatorSells: creator?.sells ?? 0,
    creatorSellVolume: creatorSold,
  })
  const pairAddr = t.pairToken
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
      riskLevel: riskLevelOf(signals),
      signals,
      details: {
        token: { address: t.address, url: link(t.address) },
        creator: { address: t.creator, url: link(t.creator) },
        curve: t.curve ? { address: t.curve, url: link(t.curve) } : null,
        pair: pairAddr ? { address: pairAddr, symbol: PAIR_SYMBOLS[pairAddr.toLowerCase()] ?? null, decimals } : null,
        launchedAt: t.launchedAt.toISOString(),
        graduatedAt: toIso(t.graduatedAt),
        activity: {
          uniqueTraders: overall?.traders ?? 0,
          uniqueBuyers: buy?.traders ?? 0,
          uniqueSellers: sell?.traders ?? 0,
          tradesLast1h: overall?.h1 ?? 0,
          tradesLast24h: overall?.h24 ?? 0,
          firstTradeAt: toIso(overall?.first ?? null),
          lastTradeAt: toIso(overall?.last ?? null),
          volume: {
            buyRaw: buyVol.toString(),
            sellRaw: sellVol.toString(),
            netRaw: (buyVol - sellVol).toString(),
            buyFormatted: formatUnits(buyVol, dec),
            sellFormatted: formatUnits(sellVol, dec),
            netFormatted: signed(buyVol - sellVol, dec),
          },
          largestTrade: largest
            ? {
                side: largest.side,
                quoteRaw: String(largest.quoteAmount),
                quoteFormatted: formatUnits(BigInt(largest.quoteAmount), largest.quoteDecimals),
                trader: largest.trader,
                at: largest.at.toISOString(),
              }
            : null,
        },
        creatorActivity: {
          trades: (creator?.buys ?? 0) + (creator?.sells ?? 0),
          buys: creator?.buys ?? 0,
          sells: creator?.sells ?? 0,
          soldRaw: creatorSold.toString(),
          soldFormatted: formatUnits(creatorSold, dec),
        },
        holders,
      },
      disclaimer: ASK_DISCLAIMER,
    },
  }
}
