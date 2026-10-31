'use client'

import { useCallback, useEffect, useState } from 'react'
import { getAddress } from 'viem'
import { createSiweMessage } from 'viem/siwe'
import { createApiClient, type MeResponse } from '@nexa-ai/api-client'
import { clearToken, getToken, setToken } from '@/lib/session'

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function statusOf(err: unknown): string {
  return /HTTP (\d+)/.exec(err instanceof Error ? err.message : '')?.[1] ?? ''
}

export function AccountPanel({ apiUrl }: { apiUrl: string | undefined }) {
  const client = createApiClient({ baseUrl: apiUrl })
  const [me, setMe] = useState<MeResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  const load = useCallback(async () => {
    const token = getToken()
    if (!token) return setChecked(true)
    try {
      setMe(await createApiClient({ baseUrl: apiUrl }).me(token))
    } catch {
      clearToken() // sesi kedaluwarsa atau tidak valid
    }
    setChecked(true)
  }, [apiUrl])

  useEffect(() => {
    void load()
  }, [load])

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
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
      const session = await client.verify({ message, signature })
      setToken(session.token)
      await load()
    } catch (err) {
      const code = statusOf(err)
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'no-wallet'
          ? 'No browser wallet found. Install a wallet such as MetaMask, then reload this page.'
          : /rejected|denied|4001/i.test(msg)
            ? 'You closed the signature request. Nothing was sent.'
            : code === '503' || code === '404'
              ? 'Wallet login is not open yet. It switches on together with the paid features.'
              : code === '401'
                ? 'The signature could not be verified. Try again.'
                : 'Something went wrong. Try again in a moment.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    const token = getToken()
    clearToken()
    setMe(null)
    if (token) await client.logout(token).catch(() => undefined)
  }

  if (!checked) return <div className="pg-note">Checking session…</div>

  if (!me) {
    return (
      <>
        <div className="card pg-card">
          <span className="label" style={{ marginBottom: 0 }}>
            Sign in with your wallet
          </span>
          <h3>Prove you own a wallet. No transaction, no gas.</h3>
          <p className="pg-note">
            You sign a short message in your wallet (Sign-In with Ethereum). NEXA never asks for your keys, and the signature cannot move funds. The session ends when you close this tab.
          </p>
          <button className="btn btn-org" type="button" onClick={signIn} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Waiting for wallet…' : 'Connect wallet '}
            <span className="ar">→</span>
          </button>
        </div>
        {error ? (
          <div className="pg-msg err" role="alert" style={{ maxWidth: 640 }}>
            {error}
          </div>
        ) : null}
      </>
    )
  }

  const h = me.holder
  return (
    <>
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Signed in
        </span>
        <h3 className="mono-v">{short(me.address)}</h3>
        <div className="pg-kv">
          <div>
            <span className="k">$NEXA holder</span>
            <span className="v">{!h.enabled ? 'Not open yet' : h.isHolder ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="k">Balance</span>
            <span className="v">{h.balance ? `${h.balance.formatted} $NEXA` : '—'}</span>
          </div>
          <div>
            <span className="k">Holder threshold</span>
            <span className="v">{h.threshold ? `${h.threshold.formatted} $NEXA` : '—'}</span>
          </div>
        </div>
        <button className="btn btn-ghost" type="button" onClick={signOut} style={{ alignSelf: 'flex-start' }}>
          Sign out
        </button>
      </div>

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Holder benefits · {me.benefits.month}
        </span>
        {!h.enabled ? (
          <p className="pg-note">Holder benefits open after $NEXA launches on Pons V2 and the holder threshold is set.</p>
        ) : (
          <div className="pg-kv">
            <div>
              <span className="k">Early alerts</span>
              <span className="v">{me.benefits.earlyAlerts ? 'Included' : 'Hold the threshold to unlock'}</span>
            </div>
            <div>
              <span className="k">Free Ask NEXA reports</span>
              <span className="v">
                {me.benefits.freeAsksRemaining} of {me.benefits.freeAsksPerMonth} left this month
              </span>
            </div>
          </div>
        )}
        <p className="pg-note">
          <a className="pg-link" href="/ask">
            Use a free report on Ask NEXA →
          </a>
        </p>
      </div>
    </>
  )
}
