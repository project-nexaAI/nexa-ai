import type { Metadata } from 'next'
import type { Prediction } from '@nexa-ai/api-client'
import { Empty, PageShell } from '@/components/pages/PageShell'
import { api, safe } from '@/lib/api'
import { fmtUtc, shortHash } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Proof of Intelligence · NEXA', alternates: { canonical: '/proof' } }

function Row({ p }: { p: Prediction }) {
  const r = p.revealed
  return (
    <a className="pg-row" href={`/predictions/${p.id}`}>
      <div className="main">
        <b>{r ? r.text : `Commit #${p.id}`}</b>
        <span className="mono">{shortHash(p.hash)}</span>
      </div>
      <div className="cell">
        <span className="k">Committed</span>
        <span className="mono-v">{fmtUtc(p.committedAt)}</span>
      </div>
      <div className="cell">
        <span className="k">{r ? 'Asset' : 'Matures'}</span>
        <span className="mono-v">{r ? `${r.assetSymbol} ${r.direction === 'up' ? '↑' : '↓'}` : fmtUtc(p.maturesAt)}</span>
      </div>
      <div className="cell">
        <span className="k">Return</span>
        <span className="mono-v">{r ? r.returnFormatted : '—'}</span>
      </div>
      <span className={`pg-pill ${r ? (r.won ? 'win' : 'loss') : ''}`}>{r ? (r.won ? 'Won' : 'Lost') : 'Pending'}</span>
    </a>
  )
}

export default async function ProofPage() {
  const proof = await safe(api().getProof())
  return (
    <PageShell
      current="/proof"
      label="Proof of Intelligence"
      title="Every call,"
      dim="on-chain and scored."
      intro="Each prediction is hashed and committed to NexaLedger before it is posted, then scored automatically against the Chainlink oracle price. The record below cannot be edited or deleted."
    >
      {!proof ? (
        <Empty title="Data unavailable">The record could not be loaded right now. Try again in a moment.</Empty>
      ) : (
        <>
          <div className="pg-grid">
            <div className="card pg-stat">
              <span className="n up">{proof.formatted.winRate ?? '—'}</span>
              <span className="t">Public win rate</span>
            </div>
            <div className="card pg-stat">
              <span className="n">{proof.formatted.avgReturn ?? '—'}</span>
              <span className="t">Avg return per call</span>
            </div>
            <div className="card pg-stat">
              <span className="n">{proof.stats.scored}</span>
              <span className="t">Calls scored</span>
            </div>
            <div className="card pg-stat">
              <span className="n">{proof.stats.pending}</span>
              <span className="t">Pending</span>
            </div>
          </div>

          {proof.current ? (
            <div className="card pg-card">
              <span className="label" style={{ marginBottom: 0 }}>
                Prediction of the Day · day {proof.current.day} of {proof.current.prediction.horizonDays}
              </span>
              <h3>Committed on-chain, contents sealed until reveal</h3>
              <div className="pg-hash">{proof.current.prediction.hash}</div>
              <div className="pg-kv">
                <div>
                  <span className="k">Committed</span>
                  <span className="v">{fmtUtc(proof.current.prediction.committedAt)}</span>
                </div>
                <div>
                  <span className="k">Reveal and score</span>
                  <span className="v">{fmtUtc(proof.current.prediction.maturesAt)}</span>
                </div>
                <div>
                  <span className="k">Commit transaction</span>
                  <a className="v pg-link" href={proof.current.prediction.commitTxUrl} target="_blank" rel="noopener">
                    View on Blockscout
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <div className="label">Recent calls</div>
          {proof.recent.length === 0 ? (
            <Empty title="No calls yet">
              The first Prediction of the Day appears here once it is committed. The win rate is published after the first call is scored.
            </Empty>
          ) : (
            <div className="pg-list">
              {proof.recent.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </div>
          )}
          <p className="pg-note" style={{ marginTop: 22 }}>
            Scored by the oracle, not by NEXA. Calls can be wrong. Nothing here is financial advice.
          </p>
        </>
      )}
    </PageShell>
  )
}
