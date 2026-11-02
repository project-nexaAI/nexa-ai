'use client'

import { useEffect, useMemo, useState } from 'react'
import { createApiClient, type AskPlanResponse, type AskResponse } from '@nexa-ai/api-client'
import { bpsText, fmtAge } from '@/lib/format'
import { getToken } from '@/lib/session'
import { PAYMENT_FAILED, sendUsdgPayment, walletMessage } from '@/lib/wallet-pay'

const CREDIT_MESSAGES: Record<string, string> = {
  '401': 'Connect your wallet in the top bar first to use a free holder credit.',
  '403': 'This wallet does not hold enough $NEXA for free reports.',
  '402': 'No free reports left this month. You can still pay $1 in USDG.',
}

const MESSAGES: Record<string, string> = {
  '400': 'Check the token address and the transaction hash: both must be valid 0x values.',
  '402': 'We could not find a valid payment in that transaction. It must be a confirmed USDG transfer to the payment address, for at least the report price.',
  '409': 'That payment was already used for a report. Each payment covers one report.',
  '422': 'NEXA does not have enough data on this token, or it is younger than one hour. Your payment was not used, so you can try again later.',
  '503': 'Ask NEXA is not open yet. Paid features are switched on after the legal review.',
  '404': 'Ask NEXA is not available yet.',
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export function AskForm({ apiUrl }: { apiUrl: string | undefined }) {
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl])
  const [address, setAddress] = useState('')
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AskResponse | null>(null)
  /** Rencana pembayaran; null = pembayaran dari wallet belum tersedia, form manual (tempel hash) tetap bisa dipakai. */
  const [plan, setPlan] = useState<AskPlanResponse | null>(null)
  /** Pembayaran yang sudah terkirim tetapi laporannya belum jadi (mis. token < 1 jam): dipakai lagi, tidak bayar dua kali. */
  const [paidHash, setPaidHash] = useState<string | null>(null)

  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => setSignedIn(Boolean(getToken())), [])
  useEffect(() => {
    let alive = true
    client
      .getAskPlan()
      .then((p) => alive && setPlan(p))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client])

  async function requestReport(body: { address: string; txHash?: string }, token?: string, credit = false) {
    try {
      setResult(await client.ask(body, token))
      setPaidHash(null)
    } catch (err) {
      const code = /HTTP (\d+)/.exec(err instanceof Error ? err.message : '')?.[1] ?? ''
      let text = (credit ? CREDIT_MESSAGES[code] : undefined) ?? MESSAGES[code] ?? 'Something went wrong. Try again in a moment.'
      // Bayar sudah terkirim tetapi laporan gagal sebelum pembayaran dipakai: arahkan untuk mencoba lagi tanpa membayar ulang.
      if (code === '422' && body.txHash) text += ' Press the button again to retry with the same payment.'
      setError(text)
    }
  }

  async function run(useCredit: boolean) {
    setBusy(true)
    setError(null)
    setResult(null)
    setStatus(null)
    await requestReport(useCredit ? { address: address.trim() } : { address: address.trim(), txHash: txHash.trim() }, useCredit ? (getToken() ?? undefined) : undefined, useCredit)
    setBusy(false)
  }

  /** Satu klik: bayar dari wallet, tunggu konfirmasi, lalu minta laporan. Pembayaran yang sudah ada dipakai lagi. */
  async function payAndAsk() {
    if (!plan) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      let hash = paidHash
      if (!hash) {
        setStatus('Confirm the payment in your wallet…')
        const paid = await sendUsdgPayment(plan, undefined, () => setStatus('Payment sent. Waiting for it to confirm…'))
        hash = paid.hash
        if (!paid.confirmed) {
          setPaidHash(hash)
          setError('The payment is still confirming. Press the button again in a minute; the same payment will be used.')
          return
        }
        setPaidHash(hash)
      }
      setStatus('Payment confirmed. Building the report…')
      await requestReport({ address: address.trim(), txHash: hash })
    } catch (err) {
      if (err instanceof Error && err.message === PAYMENT_FAILED) setPaidHash(null)
      setError(walletMessage(err) ?? (err instanceof Error && err.message === PAYMENT_FAILED ? err.message : 'Something went wrong. Try again in a moment.'))
    } finally {
      setStatus(null)
      setBusy(false)
    }
  }

  return (
    <>
      <form
        className="pg-form"
        onSubmit={(e) => {
          e.preventDefault()
          void (plan ? payAndAsk() : run(false))
        }}
      >
        <label>
          <span className="k">Token address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" required pattern="0x[0-9a-fA-F]{40}" spellCheck={false} autoComplete="off" />
        </label>
        {plan ? (
          <>
            <button className="btn btn-org" type="submit" disabled={busy || !ADDRESS.test(address.trim())}>
              {busy ? (status ?? 'Working…') : paidHash ? 'Get the report (already paid) ' : `Pay ${plan.price.formatted} USDG and get the report `}
              <span className="ar">→</span>
            </button>
            <details className="pg-note" style={{ maxWidth: 640 }}>
              <summary>Already paid? Use a transaction hash instead</summary>
              <label style={{ display: 'block', marginTop: 10 }}>
                <span className="k">Payment transaction hash</span>
                <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" pattern="0x[0-9a-fA-F]{64}" spellCheck={false} autoComplete="off" />
              </label>
              <button className="btn btn-ghost" type="button" style={{ marginTop: 10 }} disabled={busy || !ADDRESS.test(address.trim()) || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())} onClick={() => void run(false)}>
                Get the report with this hash
              </button>
            </details>
          </>
        ) : (
          <>
            <label>
              <span className="k">Payment transaction hash</span>
              <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" required pattern="0x[0-9a-fA-F]{64}" spellCheck={false} autoComplete="off" />
            </label>
            <button className="btn btn-org" type="submit" disabled={busy}>
              {busy ? 'Checking payment…' : 'Get the report '}
              <span className="ar">→</span>
            </button>
          </>
        )}
        {signedIn ? (
          <button className="btn btn-ghost" type="button" disabled={busy || !ADDRESS.test(address.trim())} onClick={() => void run(true)}>
            Use a free holder credit
          </button>
        ) : null}
      </form>
      {error ? (
        <div className="pg-msg err" role="alert" style={{ marginTop: 16, maxWidth: 640 }}>
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="card pg-card" style={{ marginTop: 20 }} aria-live="polite">
          <span className="label" style={{ marginBottom: 0 }}>
            Risk summary
          </span>
          <h3>
            {result.report.symbol ?? 'Unknown token'} {result.report.name ? `· ${result.report.name}` : ''}
          </h3>
          <div className="pg-kv">
            <div>
              <span className="k">Age</span>
              <span className="v">{fmtAge(result.report.ageSeconds)}</span>
            </div>
            <div>
              <span className="k">Graduated</span>
              <span className="v">{result.report.graduated ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="k">Creator tax</span>
              <span className="v">{bpsText(result.report.creatorTaxBps)}</span>
            </div>
            <div>
              <span className="k">Top holder share</span>
              <span className="v">{bpsText(result.report.topHolderShareBps)}</span>
            </div>
            <div>
              <span className="k">Trades (buys · sells)</span>
              <span className="v">
                {result.report.trades.total} ({result.report.trades.buys} · {result.report.trades.sells})
              </span>
            </div>
          </div>
          <div className="pg-flags">
            {result.report.redFlags.length === 0 ? (
              <span className="pg-flag ok">No red flags found</span>
            ) : (
              result.report.redFlags.map((f) => (
                <span key={f} className="pg-flag">
                  {f}
                </span>
              ))
            )}
          </div>
          {result.report.unknowns.length > 0 ? <p className="pg-note">Not known yet: {result.report.unknowns.join('; ')}.</p> : null}
          <p className="pg-note">{result.report.disclaimer}</p>
          {result.paymentTxUrl ? (
            <a className="pg-link" href={result.paymentTxUrl} target="_blank" rel="noopener">
              Payment on Blockscout ↗
            </a>
          ) : (
            <p className="pg-note">Free holder credit used.</p>
          )}
        </div>
      ) : null}
    </>
  )
}
