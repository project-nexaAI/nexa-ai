import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, isNull, lt } from 'drizzle-orm'
import { getAddress, parseAbi, recoverMessageAddress, type Address, type Hex, type PublicClient } from 'viem'
import { parseSiweMessage } from 'viem/siwe'
import { askCreditUses, authNonces, authSessions } from '@nexa-ai/db'
import type { MeResponse } from '@nexa-ai/api-client'
import type { Db } from './app'
import { formatUnits } from './format'
import { proStatus } from './pro'

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)'])

export interface HolderConfig {
  client: Pick<PublicClient, 'readContract'>
  /** Token $NEXA. Belum ada sebelum launch di Pons V2: tanpa ini benefit holder nonaktif. */
  token: Address
  /** Saldo minimum (unit terkecil) agar jadi holder. */
  threshold: bigint
  decimals: number
  freeAsksPerMonth: number
}

export interface AuthConfig {
  /** Domain web yang boleh menandatangani (host, mis. nexa.example atau xyz.vercel.app). */
  domains: string[]
  sessionTtlSeconds: number
  nonceTtlSeconds: number
  holder?: HolderConfig
}

export const monthKey = (d: Date) => d.toISOString().slice(0, 7)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export async function createNonce(db: Db, cfg: AuthConfig, now: Date) {
  await db.delete(authNonces).where(lt(authNonces.expiresAt, now)) // bersihkan yang kedaluwarsa
  // EIP-4361: nonce hanya huruf dan angka (hex), kalau tidak pembuat pesan di wallet menolaknya.
  const nonce = randomBytes(16).toString('hex')
  const expiresAt = new Date(now.getTime() + cfg.nonceTtlSeconds * 1000)
  await db.insert(authNonces).values({ nonce, expiresAt })
  return { nonce, expiresAt: expiresAt.toISOString() }
}

export type VerifyResult =
  | { ok: true; token: string; address: string; expiresAt: string }
  | { ok: false; reason: 'invalid_message' | 'domain_mismatch' | 'bad_signature' | 'bad_nonce' | 'expired_message' }

/** Login SIWE (EIP-4361) untuk wallet EOA: tanda tangan dipulihkan lalu dicocokkan dengan alamat di pesan. */
export async function verifyLogin(db: Db, cfg: AuthConfig, req: { message: string; signature: string }, now: Date): Promise<VerifyResult> {
  const m = parseSiweMessage(req.message)
  if (!m.address || !m.nonce || !m.domain || !m.issuedAt) return { ok: false, reason: 'invalid_message' }
  if (!cfg.domains.includes(m.domain)) return { ok: false, reason: 'domain_mismatch' }
  // Pesan harus baru (<= 10 menit) dan belum kedaluwarsa bila memuat expirationTime.
  if (now.getTime() - m.issuedAt.getTime() > 10 * 60_000 || m.issuedAt.getTime() - now.getTime() > 60_000) return { ok: false, reason: 'expired_message' }
  if (m.expirationTime && m.expirationTime.getTime() < now.getTime()) return { ok: false, reason: 'expired_message' }
  if (m.notBefore && m.notBefore.getTime() > now.getTime()) return { ok: false, reason: 'expired_message' }

  let recovered: Address
  try {
    recovered = await recoverMessageAddress({ message: req.message, signature: req.signature as Hex })
  } catch {
    return { ok: false, reason: 'bad_signature' }
  }
  if (recovered.toLowerCase() !== m.address.toLowerCase()) return { ok: false, reason: 'bad_signature' }

  // Nonce sekali pakai: pembaruan atomik hanya berhasil untuk nonce yang ada, belum dipakai, dan belum kedaluwarsa.
  const used = await db
    .update(authNonces)
    .set({ usedAt: now })
    .where(and(eq(authNonces.nonce, m.nonce), isNull(authNonces.usedAt), gt(authNonces.expiresAt, now)))
    .returning({ nonce: authNonces.nonce })
  if (used.length === 0) return { ok: false, reason: 'bad_nonce' }

  const token = `nexa_s_${randomBytes(32).toString('hex')}`
  const expiresAt = new Date(now.getTime() + cfg.sessionTtlSeconds * 1000)
  const address = getAddress(m.address)
  await db.insert(authSessions).values({ tokenHash: sha256(token), address, expiresAt })
  return { ok: true, token, address, expiresAt: expiresAt.toISOString() }
}

export async function sessionFrom(db: Db, authorization: string | undefined, now: Date): Promise<{ address: string; tokenHash: string } | null> {
  const token = /^Bearer (nexa_s_[0-9a-f]{64})$/.exec(authorization ?? '')?.[1]
  if (!token) return null
  const tokenHash = sha256(token)
  const [row] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
  return row ? { address: row.address, tokenHash } : null
}

export const endSession = (db: Db, tokenHash: string) => db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))

const units = (raw: bigint, decimals: number) => ({ raw: raw.toString(), decimals, formatted: formatUnits(raw, decimals) })

export async function holderStatus(h: HolderConfig | undefined, address: string): Promise<MeResponse['holder']> {
  if (!h) return { enabled: false, isHolder: false, balance: null, threshold: null }
  let balance: bigint
  try {
    balance = await h.client.readContract({ address: h.token, abi: erc20, functionName: 'balanceOf', args: [address as Address] })
  } catch {
    // Saldo tidak terbaca: jangan memberi benefit (tidak menebak).
    return { enabled: true, isHolder: false, balance: null, threshold: units(h.threshold, h.decimals) }
  }
  return { enabled: true, isHolder: balance >= h.threshold, balance: units(balance, h.decimals), threshold: units(h.threshold, h.decimals) }
}

export async function freeAsksUsed(db: Db, address: string, now: Date): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(askCreditUses)
    .where(and(eq(askCreditUses.address, address), eq(askCreditUses.month, monthKey(now))))
  return Number(r!.n)
}

export async function buildMe(db: Db, cfg: AuthConfig, address: string, now: Date): Promise<MeResponse> {
  const holder = await holderStatus(cfg.holder, address)
  const perMonth = holder.isHolder ? (cfg.holder?.freeAsksPerMonth ?? 0) : 0
  const used = holder.isHolder ? await freeAsksUsed(db, address, now) : 0
  return {
    address,
    holder,
    benefits: { earlyAlerts: holder.isHolder, freeAsksPerMonth: perMonth, freeAsksRemaining: Math.max(0, perMonth - used), month: monthKey(now) },
    pro: await proStatus(db, address, now),
  }
}
