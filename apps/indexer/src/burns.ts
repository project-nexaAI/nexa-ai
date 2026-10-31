import { burns, type createDb } from '@nexa-ai/db'

type Db = ReturnType<typeof createDb>['db']

export interface BurnLog {
  args: { caller: string; pairSpent: bigint; nexaBurned: bigint }
  blockNumber: bigint
  logIndex: number
  transactionHash: string
}

/** Event Burned dari BurnVault -> tabel burns (dibaca GET /burn). Idempoten per `${tx}-${logIndex}`. */
export async function processBurns(db: Db, logs: BurnLog[], blockTime: (n: bigint) => Promise<Date>): Promise<number> {
  let inserted = 0
  for (const l of logs) {
    const at = await blockTime(l.blockNumber)
    const r = await db
      .insert(burns)
      .values({
        id: `${l.transactionHash}-${l.logIndex}`,
        txHash: l.transactionHash,
        nexaBurned: l.args.nexaBurned.toString(),
        pairSpent: l.args.pairSpent.toString(),
        at,
        blockNumber: l.blockNumber,
      })
      .onConflictDoNothing()
      .returning({ id: burns.id })
    inserted += r.length
  }
  return inserted
}
