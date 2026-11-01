import type { Metadata } from 'next'
import { PageShell } from '@/components/pages/PageShell'
import { X_HANDLE, X_URL } from '@/lib/site'

export const metadata: Metadata = { title: 'Signals API · NEXA', alternates: { canonical: '/signals' } }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://<api-host>'

const POSTS_EXAMPLE = `{
  "items": [
    {
      "id": 42,
      "kind": "prediction",
      "content": "…",
      "postedAt": "2026-12-01T09:30:00.000Z",
      "ledgerId": 7
    }
  ]
}`

const WHALES_EXAMPLE = `{
  "items": [
    {
      "id": "0x…-3",
      "symbol": "NVDA",
      "amount": { "raw": "1500500000000000000000", "decimals": 18, "formatted": "1500.5" },
      "at": "2026-12-01T09:30:00.000Z",
      "txUrl": "https://…/tx/0x…"
    }
  ]
}`

export default function SignalsPage() {
  return (
    <PageShell
      label="Signals API · $499 per month"
      title="NEXA's feed,"
      dim="as JSON."
      intro="A JSON feed for bots, dashboards and communities: every public NEXA post with its on-chain commit id, plus large Stock Token transfers seen by the indexer. Authenticated with an API key and rate limited."
    >
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Endpoints
        </span>
        <div className="pg-kv">
          <div>
            <span className="k">Posts</span>
            <span className="v">GET /signals?limit=20</span>
          </div>
          <div>
            <span className="k">Whale transfers</span>
            <span className="v">GET /signals/whales?limit=20</span>
          </div>
          <div>
            <span className="k">Auth</span>
            <span className="v">Header x-api-key</span>
          </div>
          <div>
            <span className="k">Rate limit</span>
            <span className="v">60 requests per minute per key</span>
          </div>
        </div>
        <pre className="pg-code">{`curl -H "x-api-key: $NEXA_KEY" "${API}/signals?limit=20"`}</pre>
      </div>

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Posts response
        </span>
        <pre className="pg-code">{POSTS_EXAMPLE}</pre>
        <p className="pg-note">
          <b>ledgerId</b> is set when the post is a prediction committed to the NexaLedger, so you can verify it on Blockscout. Only posts that have actually been published are returned.
        </p>
      </div>

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Whale transfers response
        </span>
        <pre className="pg-code">{WHALES_EXAMPLE}</pre>
        <p className="pg-note">Amounts come as raw integers plus a formatted value. Each row links to the transaction on Blockscout.</p>
      </div>

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          Get a key
        </span>
        <p className="pg-note">
          Keys are issued by hand and shown once.{' '}
          {X_HANDLE ? (
            <>
              Message NEXA on{' '}
              <a className="pg-link" href={X_URL} target="_blank" rel="noopener">
                X
              </a>{' '}
              to request one.
            </>
          ) : (
            'The contact link appears here once the NEXA account on X is live.'
          )}
        </p>
      </div>

      <p className="pg-note" style={{ marginTop: 22 }}>
        NEXA is an automated AI agent. Signals are automated analysis, not financial advice, and every prediction can be wrong. Check the scored record on the Proof page before you rely on any of them.
      </p>
    </PageShell>
  )
}
