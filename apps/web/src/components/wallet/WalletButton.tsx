'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAddress } from 'viem'
import { createSiweMessage } from 'viem/siwe'
import { createApiClient, type MeResponse } from '@nexa-ai/api-client'
import { clearToken, getToken, setToken } from '@/lib/session'

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const statusOf = (err: unknown) => /HTTP (\d+)/.exec(err instanceof Error ? err.message : '')?.[1] ?? ''

function messageFor(err: unknown): string {
  const code = statusOf(err)
  const msg = err instanceof Error ? err.message : ''
  if (msg === 'no-wallet') return 'No browser wallet found. Install a wallet such as MetaMask, then reload.'
  if (/rejected|denied|4001/i.test(msg)) return 'Signature request closed. Nothing was sent.'
  if (code === '503' || code === '404') return 'Wallet login is not open yet. It switches on with the paid features.'
  if (code === '401') return 'The signature could not be verified. Try again.'
  return 'Something went wrong. Try again in a moment.'
}

/** Tombol connect wallet di navbar (SIWE). Sesi bearer di sessionStorage; tidak ada transaksi dan tidak ada gas. */
export function WalletButton({ apiUrl }: { apiUrl: string | undefined }) {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      setMe(await createApiClient({ baseUrl: apiUrl }).me(token))
    } catch (err) {
      // 401 = sesi kedaluwarsa; 503 = fitur dimatikan lagi. Jangan menahan token yang tidak berguna.
      if (statusOf(err) === '401' || statusOf(err) === '503') clearToken()
    }
  }, [apiUrl])

  useEffect(() => {
    void load()
  }, [load])

  // Tutup panel saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function signIn() {
    setBusy(true)
    setError(null)
    setOpen(true)
    try {
      const client = createApiClient({ baseUrl: apiUrl })
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
      if (!eth) throw new Error('no-wallet')
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const address = getAddress(accounts[0]!)
      const { nonce } = await client.getNonce()
      const chainId = Number((await eth.request({ method: 'eth_chainId' })) as string)
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: 'Sign in to NEXA. This only proves you own this wallet: it sends no transaction and costs no gas.',
        issuedAt: new Date(),
      })
      const signature = (await eth.request({ method: 'personal_sign', params: [message, address] })) as string
      setToken((await client.verify({ message, signature })).token)
      await load()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    const token = getToken()
    clearToken()
    setMe(null)
    setOpen(false)
    if (token) await createApiClient({ baseUrl: apiUrl }).logout(token).catch(() => undefined)
  }

  const h = me?.holder
  return (
    <div className="wallet" ref={root}>
      <button
        type="button"
        className="btn btn-org wallet-btn"
        data-magnet=""
        onClick={() => (me ? setOpen((o) => !o) : void signIn())}
        disabled={busy}
        aria-haspopup={me ? 'dialog' : undefined}
        aria-expanded={me ? open : undefined}
      >
        {busy ? (
          'Waiting…'
        ) : me ? (
          short(me.address)
        ) : (
          <>
            <span className="wl-full">Connect wallet</span>
            <span className="wl-short">Connect</span>
          </>
        )}
        <span className="ar" aria-hidden="true">
          {me ? '▾' : '→'}
        </span>
      </button>

      {open && (me || error) ? (
        <div className="wallet-pop card" role="dialog" aria-label="Wallet">
          {error ? (
            <p className="wallet-err" role="alert">
              {error}
            </p>
          ) : null}
          {me && h ? (
            <>
              <div className="k">Signed in</div>
              <div className="mono-v">{short(me.address)}</div>
              <div className="wallet-row">
                <span className="k">$NEXA holder</span>
                <span className="v">{!h.enabled ? 'Not open yet' : h.isHolder ? 'Yes' : 'No'}</span>
              </div>
              {h.enabled ? (
                <>
                  <div className="wallet-row">
                    <span className="k">Balance</span>
                    <span className="v">{h.balance ? `${h.balance.formatted} $NEXA` : '—'}</span>
                  </div>
                  <div className="wallet-row">
                    <span className="k">Early alerts</span>
                    <span className="v">{me.benefits.earlyAlerts ? 'Included' : 'No'}</span>
                  </div>
                  <div className="wallet-row">
                    <span className="k">Free reports</span>
                    <span className="v">
                      {me.benefits.freeAsksRemaining}/{me.benefits.freeAsksPerMonth} left
                    </span>
                  </div>
                </>
              ) : (
                <p className="wallet-note">Holder benefits open after $NEXA launches.</p>
              )}
              <div className="wallet-row">
                <span className="k">NEXA Pro</span>
                <span className="v">{me.pro.active ? `Active until ${me.pro.expiresAt?.slice(0, 10)}` : 'Not active'}</span>
              </div>
              <a className="pg-link wallet-link" href="/pro">
                {me.pro.active ? 'Manage NEXA Pro →' : 'Get NEXA Pro →'}
              </a>
              <a className="pg-link wallet-link" href="/ask">
                Use a free report on Ask NEXA →
              </a>
              <button type="button" className="btn btn-ghost wallet-out" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
