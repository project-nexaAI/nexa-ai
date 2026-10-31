import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/pages/PageShell'
import { api, safe } from '@/lib/api'
import { fmtUtc } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Prediction · NEXA' }

export default async function PredictionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n) || n < 0) notFound()
  const p = await safe(api().getPrediction(n))
  if (!p) notFound()
  const r = p.revealed

  return (
    <PageShell
      current="/proof"
      label={`Commit #${p.id}`}
      title={r ? 'Revealed' : 'Sealed until'}
      dim={r ? (r.won ? 'and it won.' : 'and it lost.') : fmtUtc(p.maturesAt)}
      intro={
        r
          ? 'The prediction was hashed and committed before it was posted. Its contents were opened at maturity and scored by the oracle.'
          : 'This prediction is committed on-chain. Its text stays hidden until maturity so it cannot be copied before it is proven.'
      }
    >
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Commit hash
        </span>
        <div className="pg-hash">{p.hash}</div>
        <div className="pg-kv">
          <div>
            <span className="k">Status</span>
            <span className="v">{p.status}</span>
          </div>
          <div>
            <span className="k">Committed</span>
            <span className="v">{fmtUtc(p.committedAt)}</span>
          </div>
          <div>
            <span className="k">Matures</span>
            <span className="v">{fmtUtc(p.maturesAt)}</span>
          </div>
          <div>
            <span className="k">Horizon</span>
            <span className="v">{p.horizonDays} days</span>
          </div>
          <div>
            <span className="k">Commit transaction</span>
            <a className="v pg-link" href={p.commitTxUrl} target="_blank" rel="noopener">
              View on Blockscout
            </a>
          </div>
        </div>
      </div>

      {r ? (
        <div className="card pg-card">
          <span className="label" style={{ marginBottom: 0 }}>
            Revealed prediction
          </span>
          <h3>“{r.text}”</h3>
          <div className="pg-kv">
            <div>
              <span className="k">Asset</span>
              <span className="v">{r.assetSymbol}</span>
            </div>
            <div>
              <span className="k">Direction</span>
              <span className="v">{r.direction === 'up' ? 'Up' : 'Down'}</span>
            </div>
            <div>
              <span className="k">Result</span>
              <span className="v">{r.won ? 'Won' : 'Lost'}</span>
            </div>
            <div>
              <span className="k">Return (in the call’s direction)</span>
              <span className="v">{r.returnFormatted}</span>
            </div>
            <div>
              <span className="k">Reveal transaction</span>
              <a className="v pg-link" href={r.revealTxUrl} target="_blank" rel="noopener">
                View on Blockscout
              </a>
            </div>
          </div>
        </div>
      ) : null}
      <p className="pg-note">
        <a className="pg-link" href="/proof">
          ← Back to the full record
        </a>
      </p>
    </PageShell>
  )
}
