import { eq, inArray, sql } from 'drizzle-orm'
import { getAddress, zeroAddress } from 'viem'
import { ponsTokens, tokenHolders, whaleTransfers, type createDb } from '@nexa-ai/db'
import { computeRedFlags } from './process'

type Db = ReturnType<typeof createDb>['db']

export interface TransferLog {
  token: string
  from: string
  to: string
  value: bigint
  blockNumber: bigint
  logIndex: number
  transactionHash: string
}

export interface WhaleToken {
  symbol: string
  decimals: number
}

export interface HolderDeps {
  db: Db
  blockTime(blockNumber: bigint): Promise<Date>
  /** Alamat (huruf kecil) yang tidak dihitung sebagai holder: nol, burn, hook, PoolManager, executor, factory. Curve per token ditambahkan otomatis. */
  excluded: ReadonlySet<string>
  highCreatorTaxBps: number
  /** Satu holder di luar curve/pool memegang >= nilai ini (bps dari total suplai) = "Holders concentrated". */
  concentratedBps: number
  whale?: {
    /** Token yang dipantau (alamat huruf kecil). */
    tokens: ReadonlyMap<string, WhaleToken>
    minUsd: number
    /** Harga USD 8 desimal terbaru; null bila tidak terbaca (transfer tidak dinilai, tidak ditebak). */
    priceE8(token: string): Promise<bigint | null>
  }
}

const DEAD = '0x000000000000000000000000000000000000dead'

export const defaultExcluded = (addrs: (string | null | undefined)[]): Set<string> =>
  new Set([zeroAddress, DEAD, ...addrs.filter((a): a is string => Boolean(a))].map((a) => a.toLowerCase()))

const order = (a: TransferLog, b: TransferLog) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1)

/**
 * Menerapkan Transfer: (1) saldo holder token Pons + konsentrasi + red flag, (2) transfer whale token yang dipantau.
 * Bukan idempoten untuk saldo (delta): panggil di dalam transaksi yang sama dengan pembaruan kursor.
 */
export async function applyTransfers(deps: HolderDeps, logs: TransferLog[]): Promise<{ holderTokens: number; whales: number }> {
  const { db } = deps
  const sorted = [...logs].sort(order)

  // ---- saldo holder (hanya token Pons yang dikenal)
  const tokenSet = [...new Set(sorted.map((l) => getAddress(l.token)))]
  const known = tokenSet.length ? await db.select().from(ponsTokens).where(inArray(ponsTokens.address, tokenSet)) : []
  const knownSet = new Set(known.map((t) => t.address))

  const deltas = new Map<string, { token: string; holder: string; delta: bigint }>()
  const add = (token: string, holder: string, delta: bigint) => {
    if (holder.toLowerCase() === zeroAddress) return // mint/burn ke alamat nol tidak dilacak
    const key = `${token}|${holder.toLowerCase()}`
    const e = deltas.get(key) ?? { token, holder: getAddress(holder), delta: 0n }
    e.delta += delta
    deltas.set(key, e)
  }
  for (const l of sorted) {
    const token = getAddress(l.token)
    if (!knownSet.has(token)) continue
    add(token, l.from, -l.value)
    add(token, l.to, l.value)
  }
  const rows = [...deltas.values()].filter((d) => d.delta !== 0n)
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(tokenHolders)
      .values(rows.slice(i, i + 500).map((r) => ({ token: r.token, holder: r.holder, balance: r.delta.toString() })))
      .onConflictDoUpdate({ target: [tokenHolders.token, tokenHolders.holder], set: { balance: sql`${tokenHolders.balance} + excluded.balance` } })
  }

  // ---- konsentrasi + red flag untuk token yang berubah
  const affected = new Set(rows.map((r) => r.token))
  for (const t of known.filter((k) => affected.has(k.address))) {
    const hs = await db.select().from(tokenHolders).where(eq(tokenHolders.token, t.address))
    const excl = new Set([...deps.excluded, t.curve ?? ''])
    let total = 0n
    let top = 0n
    let incomplete = false
    for (const h of hs) {
      const b = BigInt(h.balance)
      if (b < 0n) incomplete = true // riwayat tidak lengkap: jangan beri angka
      total += b
      if (!excl.has(h.holder.toLowerCase()) && b > top) top = b
    }
    const share = incomplete || total <= 0n ? null : Number((top * 10_000n) / total)
    await db
      .update(ponsTokens)
      .set({ topHolderShareBps: share, redFlags: computeRedFlags({ creatorTaxBps: t.creatorTaxBps, topHolderShareBps: share }, deps) })
      .where(eq(ponsTokens.address, t.address))
  }

  // ---- transfer whale
  let whales = 0
  if (deps.whale) {
    const prices = new Map<string, bigint | null>()
    for (const l of sorted) {
      const w = deps.whale.tokens.get(l.token.toLowerCase())
      if (!w) continue
      if (!prices.has(l.token)) prices.set(l.token, await deps.whale.priceE8(l.token))
      const price = prices.get(l.token)
      if (price === null || price === undefined || price <= 0n) continue
      // usd = value / 10^dec * price / 1e8, dihitung dalam unit sen untuk menghindari float pada nilai besar
      const cents = (l.value * price * 100n) / 10n ** BigInt(w.decimals) / 100_000_000n
      if (cents < BigInt(Math.round(deps.whale.minUsd * 100))) continue
      const at = await deps.blockTime(l.blockNumber)
      const ins = await db
        .insert(whaleTransfers)
        .values({
          id: `${l.transactionHash}-${l.logIndex}`,
          token: getAddress(l.token),
          from: getAddress(l.from),
          to: getAddress(l.to),
          amount: l.value.toString(),
          decimals: w.decimals,
          at,
          blockNumber: l.blockNumber,
        })
        .onConflictDoNothing()
        .returning({ id: whaleTransfers.id })
      whales += ins.length
    }
  }
  return { holderTokens: affected.size, whales }
}

