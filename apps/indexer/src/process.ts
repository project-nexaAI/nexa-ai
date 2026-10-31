import { eq } from 'drizzle-orm'
import { getAddress } from 'viem'
import { ponsTokens, ponsTrades, type createDb } from '@nexa-ai/db'

type Db = ReturnType<typeof createDb>['db']

/** Log Pons yang sudah di-decode (bentuk minimal, supaya mudah dites tanpa RPC). */
export type PonsLog =
  | {
      eventName: 'TokenLaunched'
      args: { token: string; curve: string; deployer: string; pairToken: string }
      blockNumber: bigint
      logIndex: number
      transactionHash: string
    }
  | {
      eventName: 'CurveBuy'
      args: { buyer: string; quoteIn: bigint; tokensOut: bigint }
      address: string
      blockNumber: bigint
      logIndex: number
      transactionHash: string
    }
  | {
      eventName: 'CurveSell'
      args: { seller: string; tokensIn: bigint; quoteOut: bigint }
      address: string
      blockNumber: bigint
      logIndex: number
      transactionHash: string
    }

export interface TokenMeta {
  name: string | null
  symbol: string | null
  creatorTaxBps: number | null
  pairDecimals: number
}

export interface ProcessDeps {
  db: Db
  /** Metadata on-chain; gagal baca -> null (jangan menebak). */
  readMeta(token: string, curve: string, pairToken: string): Promise<TokenMeta>
  blockTime(blockNumber: bigint): Promise<Date>
  /** Ambang creator tax (bps) di atas mana token diberi red flag. */
  highCreatorTaxBps: number
}

export const HIGH_CREATOR_TAX_FLAG = 'High creator tax'

export function redFlagsFor(creatorTaxBps: number | null, highCreatorTaxBps: number): string[] {
  return creatorTaxBps !== null && creatorTaxBps > highCreatorTaxBps ? [HIGH_CREATOR_TAX_FLAG] : []
}

const order = (a: PonsLog, b: PonsLog) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1)

/** Idempotent: log yang sama diproses dua kali tidak menggandakan baris. */
export async function processLogs(deps: ProcessDeps, logs: PonsLog[]): Promise<{ launches: number; trades: number }> {
  const { db } = deps
  let launches = 0
  let trades = 0
  const decimalsByToken = new Map<string, number>()

  for (const log of [...logs].sort(order)) {
    const at = await deps.blockTime(log.blockNumber)
    const id = `${log.transactionHash}-${log.logIndex}`

    if (log.eventName === 'TokenLaunched') {
      const { token, curve, deployer, pairToken } = log.args
      const meta = await deps.readMeta(token, curve, pairToken)
      const address = getAddress(token)
      decimalsByToken.set(address, meta.pairDecimals)
      const inserted = await db
        .insert(ponsTokens)
        .values({
          address,
          curve: curve.toLowerCase(),
          pairToken: getAddress(pairToken),
          creator: getAddress(deployer),
          name: meta.name,
          symbol: meta.symbol,
          launchedAt: at,
          creatorTaxBps: meta.creatorTaxBps,
          redFlags: redFlagsFor(meta.creatorTaxBps, deps.highCreatorTaxBps),
          blockNumber: log.blockNumber,
        })
        .onConflictDoNothing()
        .returning({ address: ponsTokens.address })
      launches += inserted.length
      continue
    }

    const [row] = await db.select().from(ponsTokens).where(eq(ponsTokens.curve, log.address.toLowerCase()))
    if (!row) continue // bukan curve Pons yang kita kenal (event bertanda tangan sama dari kontrak lain)

    let quoteDecimals = decimalsByToken.get(row.address)
    if (quoteDecimals === undefined && row.pairToken) {
      quoteDecimals = (await deps.readMeta(row.address, log.address, row.pairToken)).pairDecimals
      decimalsByToken.set(row.address, quoteDecimals)
    }

    const buy = log.eventName === 'CurveBuy'
    const inserted = await db
      .insert(ponsTrades)
      .values({
        id,
        token: row.address,
        trader: getAddress(buy ? log.args.buyer : log.args.seller),
        side: buy ? 'buy' : 'sell',
        tokenAmount: (buy ? log.args.tokensOut : log.args.tokensIn).toString(),
        quoteAmount: (buy ? log.args.quoteIn : log.args.quoteOut).toString(),
        quoteDecimals: quoteDecimals ?? 18,
        at,
        blockNumber: log.blockNumber,
      })
      .onConflictDoNothing()
      .returning({ id: ponsTrades.id })
    trades += inserted.length
  }
  return { launches, trades }
}
