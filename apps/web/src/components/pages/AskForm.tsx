'use client'

import { useEffect, useState } from 'react'
import { createApiClient, type AskResponse } from '@nexa-ai/api-client'
import { bpsText, fmtAge } from '@/lib/format'
import { getToken } from '@/lib/session'

const CREDIT_MESSAGES: Record<string, string> = {
  '401': 'Sign in on the Account page first to use a free holder credit.',
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

export function AskForm({ apiUrl }: { apiUrl: string | undefined }) {
  const [address, setAddress] = useState('')
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AskResponse | null>(null)

  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => setSignedIn(Boolean(getToken())), [])

  async function run(useCredit: boolean) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const client = createApiClient({ baseUrl: apiUrl })
      setResult(await client.ask(useCredit ? { address: address.trim() } : { address: address.trim(), txHash: txHash.trim() }, useCredit ? (getToken() ?? undefined) : undefined))
    } catch (err) {
      const code = /HTTP (\d+)/.exec(err instanceof Error ? err.message : '')?.[1] ?? ''
      setError((useCredit ? CREDIT_MESSAGES[code] : undefined) ?? MESSAGES[code] ?? 'Something went wrong. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form
        className="pg-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(false)
        }}
      >
        <label>
          <span className="k">Token address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" required pattern="0x[0-9a-fA-F]{40}" spellCheck={false} autoComplete="off" />
        </label>
        <label>
          <span className="k">Payment transaction hash</span>
          <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" required pattern="0x[0-9a-fA-F]{64}" spellCheck={false} autoComplete="off" />
        </label>
        <button className="btn btn-org" type="submit" disabled={busy}>
          {busy ? 'Checking payment…' : 'Get the report '}
          <span className="ar">→</span>
        </button>
        {signedIn ? (
          <button className="btn btn-ghost" type="button" disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())} onClick={() => void run(true)}>
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
