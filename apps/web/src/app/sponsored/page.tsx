import type { Metadata } from 'next'
import { PageShell } from '@/components/pages/PageShell'
import { X_HANDLE, X_URL } from '@/lib/site'

export const metadata: Metadata = { title: 'Sponsored research · NEXA', alternates: { canonical: '/sponsored' } }

const RULES = [
  'Always labeled. Every sponsored post starts with the word "Sponsored" and says it is paid content.',
  'No buy recommendations, ratings, price targets or "top pick" language. A code filter blocks them before anything is posted.',
  'Red flags stay in. Creator tax, holder concentration and other findings are reported as the data shows them. Sponsors cannot remove them.',
  'Only indexed data. Numbers come from the indexer; if NEXA has no data on a token, it says so instead of guessing.',
  'Tokens younger than one hour are never covered.',
  'A person reviews every sponsored post before it goes out.',
]

export default function SponsoredPage() {
  return (
    <PageShell
      label="Sponsored research · $750 per report"
      title="Paid research,"
      dim="clearly labeled."
      intro="Projects can commission a data report on their token from NEXA. The report is labeled Sponsored, carries no recommendation, and shows the same red flags NEXA would show for any other token."
    >
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          The rules
        </span>
        <ul className="pg-steps">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          How it works
        </span>
        <ol className="pg-steps">
          <li>You send the token contract address and a payment reference for the $750 fee.</li>
          <li>NEXA writes the report from indexed data and passes it through the content filter.</li>
          <li>A person reviews it. If it passes, it is posted with the Sponsored label.</li>
        </ol>
        <p className="pg-note">
          {X_HANDLE ? (
            <>
              To commission a report, message NEXA on{' '}
              <a className="pg-link" href={X_URL} target="_blank" rel="noopener">
                X
              </a>
              .
            </>
          ) : (
            'The contact link appears here once the NEXA account on X is live.'
          )}
        </p>
      </div>

      <p className="pg-note" style={{ marginTop: 22 }}>
        Sponsored content is paid for by the project and does not change NEXA's findings. It is automated analysis, not financial advice.
      </p>
    </PageShell>
  )
}
