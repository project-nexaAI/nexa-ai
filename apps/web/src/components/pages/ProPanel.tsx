'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { encodeFunctionData, getAddress, parseAbi } from 'viem'
import { createApiClient, type AlertEvent, type MeResponse, type ProPlanResponse, type TelegramLinkResponse } from '@nexa-ai/api-client'
import { SESSION_EVENT, clearToken, getToken } from '@/lib/session'

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }
const erc20 = parseAbi(['function transfer(address to, uint256 value) returns (bool)'])

const statusOf = (err: unknown) => /HTTP (\d+)/.exec(err instanceof Error ? err.message : '')?.[1] ?? ''
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SUBSCRIBE_MESSAGES: Record<string, string> = {
  '400': 'That does not look like a transaction hash.',
  '401': 'Your sign-in expired. Connect your wallet again in the top bar.',
  '402': 'We could not find a valid payment in that transaction. It must be a confirmed USDG transfer to the payment address, for at least the plan price.',
  '403': 'That payment was sent from a different wallet. Connect the wallet that paid.',
  '409': 'That payment was already used.',
  '503': 'NEXA Pro is not open yet. Paid features are switched on after the legal review.',
  '404': 'NEXA Pro is not available yet.',
}

function walletMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : ''
  const code = (err as { code?: number } | null)?.code
  if (msg === 'no-wallet') return 'No browser wallet found. Install a wallet such as MetaMask, then reload.'
  if (msg === 'wrong-account') return 'Your wallet is on a different account than the one you signed in with. Switch accounts, then try again.'
  if (code === 4001 || /rejected|denied/i.test(msg)) return 'The wallet request was closed. Nothing was sent.'
  if (code === 4902) return 'Your wallet does not know Robinhood Chain yet. Add the network (chain ID 4663), then try again.'
  return null
}

export function ProPanel({ apiUrl }: { apiUrl: string | undefined }) {
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl])
  const [token, setTokenState] = useState<string | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [plan, setPlan] = useState<ProPlanResponse | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [txHash, setTxHash] = useState('')
  const [link, setLink] = useState<TelegramLinkResponse | null>(null)
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [stream, setStream] = useState<'off' | 'listening' | 'reconnecting'>('off')

  // Sesi: dibaca dari sessionStorage dan diperbarui saat tombol wallet di navbar masuk/keluar.
  useEffect(() => {
    const sync = () => setTokenState(getToken())
    sync()
    window.addEventListener(SESSION_EVENT, sync)
    return () => window.removeEventListener(SESSION_EVENT, sync)
  }, [])

  useEffect(() => {
    client
      .getProPlan()
      .then(setPlan)
      .catch((err) => setPlanError(['503', '404'].includes(statusOf(err)) ? SUBSCRIBE_MESSAGES['503']! : 'The plan could not be loaded. Try again in a moment.'))
  }, [client])

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null)
      return
    }
    try {
      setMe(await client.me(token))
    } catch (err) {
      if (statusOf(err) === '401' || statusOf(err) === '503') clearToken()
      setMe(null)
    }
  }, [client, token])
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Alert real-time (SSE). Menyambung ulang dari alert terakhir; berhenti bila sesi atau langganan berakhir.
  const active = Boolean(token && me?.pro.active)
  useEffect(() => {
    if (!token || !active) {
      setStream('off')
      return
    }
    const ctl = new AbortController()
    let last: number | undefined
    void (async () => {
      while (!ctl.signal.aborted) {
        setStream('listening')
        try {
          await client.streamAlerts({
            token,
            signal: ctl.signal,
            ...(last !== undefined ? { lastEventId: last } : {}),
            onAlert: (a) => {
              last = a.id
              setAlerts((prev) => [a, ...prev.filter((x) => x.id !== a.id)].slice(0, 20))
            },
          })
        } catch (err) {
          if (ctl.signal.aborted) return
          if (statusOf(err) === '401' || statusOf(err) === '402') {
            setStream('off')
            void refresh()
            return
          }
        }
        if (ctl.signal.aborted) return
        setStream('reconnecting')
        await sleep(5000)
      }
    })()
    return () => ctl.abort()
  }, [client, token, active, refresh])

  // Setelah kode tautan dibuat, tunggu bot menandai chat sebagai tertaut.
  useEffect(() => {
    if (!link) return
    if (me?.pro.telegramLinked) {
      setLink(null)
      return
    }
    const t = setInterval(() => void refresh(), 4000)
    return () => clearInterval(t)
  }, [link, me?.pro.telegramLinked, refresh])

  async function activate(hash: string) {
    if (!token) return
    try {
      const r = await client.proSubscribe({ txHash: hash }, token)
      setNote({ kind: 'ok', text: `NEXA Pro is active until ${utc(r.expiresAt)}.` })
      setTxHash('')
      await refresh()
    } catch (err) {
      setNote({ kind: 'err', text: SUBSCRIBE_MESSAGES[statusOf(err)] ?? 'Something went wrong. Try again in a moment.' })
    }
  }

  async function pay() {
    if (!token || !me || !plan) return
    setBusy('pay')
    setNote(null)
    try {
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
      if (!eth) throw new Error('no-wallet')
      const [from] = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      if (getAddress(from!) !== me.address) throw new Error('wrong-account')
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${plan.chainId.toString(16)}` }] })
      const data = encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [getAddress(plan.recipient), BigInt(plan.price.raw)] })
      const hash = (await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: plan.usdgAddress, data }] })) as string
      setNote({ kind: 'ok', text: 'Payment sent. Waiting for it to confirm…' })
      for (let i = 0; i < 60; i++) {
        const receipt = (await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as { status?: string } | null
        if (receipt) {
          if (receipt.status !== '0x1') throw new Error('The payment transaction failed on-chain. Nothing was charged for Pro.')
          await activate(hash)
          return
        }
        await sleep(2000)
      }
      setTxHash(hash)
      setNote({ kind: 'ok', text: 'The payment is still confirming. Press "Activate with a transaction hash" in a minute.' })
    } catch (err) {
      setNote({ kind: 'err', text: walletMessage(err) ?? (err instanceof Error && err.message.startsWith('The payment') ? err.message : 'Something went wrong. Try again in a moment.') })
    } finally {
      setBusy(null)
    }
  }

  async function connectTelegram() {
    if (!token) return
    setBusy('tg')
    setNote(null)
    try {
      setLink(await client.linkTelegram(token))
    } catch (err) {
      const code = statusOf(err)
      setNote({
        kind: 'err',
        text:
          code === '402'
            ? 'Telegram alerts are for active Pro subscribers.'
            : code === '503'
              ? 'Telegram alerts are not set up yet.'
              : 'Something went wrong. Try again in a moment.',
      })
    } finally {
      setBusy(null)
    }
  }

  async function disconnectTelegram() {
    if (!token) return
    setBusy('tg')
    try {
      await client.unlinkTelegram(token)
      setLink(null)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {planError ? (
        <div className="pg-msg err" role="alert" style={{ marginBottom: 20, maxWidth: 640 }}>
          {planError}
        </div>
      ) : null}

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          The plan
        </span>
        <div className="pg-kv">
          <div>
            <span className="k">Price</span>
            <span className="v">{plan ? `$${plan.price.formatted} in USDG` : '$19 in USDG'}</span>
          </div>
          <div>
            <span className="k">Period</span>
            <span className="v">{plan ? `${plan.durationDays} days per payment` : '30 days per payment'}</span>
          </div>
          <div>
            <span className="k">Network</span>
            <span className="v">{plan ? `Robinhood Chain (${plan.chainId})` : 'Robinhood Chain'}</span>
          </div>
          <div>
            <span className="k">Pay to</span>
            <span className="v">{plan ? plan.recipient : 'Shown when Pro opens'}</span>
          </div>
        </div>
        <ul className="pg-steps">
          <li>Alerts arrive the moment NEXA approves a post, 15 minutes before it goes public on X.</li>
          <li>Get them live on this page and in a private Telegram chat.</li>
          <li>Paying more than one period adds more days. There is no auto-renewal: you pay again when you want to.</li>
        </ul>
      </div>

      {!token ? (
        <div className="pg-empty">
          <b>Connect your wallet to continue</b>
          Use the Connect wallet button in the top bar. Signing in sends no transaction and costs no gas.
        </div>
      ) : !me ? (
        <p className="pg-note">Loading your account…</p>
      ) : (
        <>
          <div className="card pg-card">
            <span className="label" style={{ marginBottom: 0 }}>
              Your subscription
            </span>
            <h3>{me.pro.active ? 'NEXA Pro is active' : me.pro.expiresAt ? 'NEXA Pro has expired' : 'Not subscribed yet'}</h3>
            {me.pro.expiresAt ? (
              <p className="pg-note">
                {me.pro.active ? 'Active until' : 'Ended on'} {utc(me.pro.expiresAt)}. Paying again {me.pro.active ? 'extends it from that date.' : 'starts a new period.'}
              </p>
            ) : null}
            <div className="pg-actions">
              <button className="btn btn-org" type="button" disabled={busy !== null || !plan} onClick={() => void pay()}>
                {busy === 'pay' ? 'Waiting for the wallet…' : `${me.pro.active ? 'Renew' : 'Pay'} ${plan ? plan.price.formatted : '19'} USDG`}
                <span className="ar">→</span>
              </button>
            </div>
            <form
              className="pg-form"
              onSubmit={(e) => {
                e.preventDefault()
                setBusy('hash')
                setNote(null)
                void activate(txHash.trim()).finally(() => setBusy(null))
              }}
            >
              <label>
                <span className="k">Already paid? Paste the transaction hash</span>
                <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" pattern="0x[0-9a-fA-F]{64}" spellCheck={false} autoComplete="off" />
              </label>
              <button className="btn btn-ghost" type="submit" disabled={busy !== null || txHash.trim() === ''}>
                Activate with a transaction hash
              </button>
            </form>
          </div>

          {me.pro.active ? (
            <>
              <div className="card pg-card">
                <span className="label" style={{ marginBottom: 0 }}>
                  Telegram alerts
                </span>
                {me.pro.telegramLinked ? (
                  <>
                    <p className="pg-note">A private chat is connected. Alerts will arrive there.</p>
                    <div className="pg-actions">
                      <button className="btn btn-ghost" type="button" disabled={busy !== null} onClick={() => void disconnectTelegram()}>
                        Disconnect Telegram
                      </button>
                    </div>
                  </>
                ) : link ? (
                  <>
                    <p className="pg-note">
                      Open the bot and press Start. This link works once and expires at {utc(link.expiresAt)}. This page updates by itself when the chat is connected.
                    </p>
                    <div className="pg-actions">
                      <a className="btn btn-org" href={link.url} target="_blank" rel="noopener">
                        Open Telegram <span className="ar">↗</span>
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="pg-actions">
                    <button className="btn btn-org" type="button" disabled={busy !== null || !plan?.telegramBot} onClick={() => void connectTelegram()}>
                      Connect Telegram <span className="ar">→</span>
                    </button>
                    {plan && !plan.telegramBot ? <span className="pg-note">Telegram alerts are not set up yet.</span> : null}
                  </div>
                )}
              </div>

              <div className="card pg-card" aria-live="polite">
                <span className="label" style={{ marginBottom: 0 }}>
                  Live alerts · {stream === 'listening' ? 'listening' : stream === 'reconnecting' ? 'reconnecting…' : 'off'}
                </span>
                {alerts.length === 0 ? (
                  <p className="pg-note">Nothing yet. New alerts appear here the moment NEXA approves a post. Keep this page open to see them.</p>
                ) : (
                  <ul className="pg-feed">
                    {alerts.map((a) => (
                      <li key={a.id}>
                        <span className="meta">
                          {a.kind.replace(/_/g, ' ')} · {utc(a.createdAt)}
                          {a.publicAt ? ` · public on X ${utc(a.publicAt)}` : ''}
                        </span>
                        <span>{a.content}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </>
      )}

      {note ? (
        <div className={`pg-msg${note.kind === 'err' ? ' err' : ''}`} role={note.kind === 'err' ? 'alert' : 'status'} style={{ marginTop: 4, maxWidth: 640 }}>
          {note.text}
        </div>
      ) : null}
    </>
  )
}
