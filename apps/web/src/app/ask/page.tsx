import type { Metadata } from 'next'
import { AskForm } from '@/components/pages/AskForm'
import { PageShell } from '@/components/pages/PageShell'

export const metadata: Metadata = { title: 'Ask NEXA · NEXA', alternates: { canonical: '/ask' } }

export default function AskPage() {
  return (
    <PageShell
      label="Ask NEXA · $1 per report"
      title="A risk summary"
      dim="for any token, on demand."
      intro="Paste a token address and pay $1 in USDG from your wallet. The payment is verified on-chain before anything runs, and the summary is built only from data NEXA has indexed. If the data is not there, it says it does not know."
    >
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          How it works
        </span>
        <ol className="pg-steps">
          <li>Paste the token address below.</li>
          <li>Press Pay and confirm the $1 USDG transfer in your wallet. Your wallet adds Robinhood Chain for you if it does not know it yet.</li>
          <li>The report appears as soon as the payment is confirmed. One payment covers one report.</li>
        </ol>
      </div>
      <AskForm apiUrl={process.env.NEXT_PUBLIC_API_URL} />
      <p className="pg-note" style={{ marginTop: 22 }}>
        Tokens younger than one hour are not analyzed, and the payment is not used in that case. Reports are automated summaries of on-chain data, not financial advice.
      </p>
    </PageShell>
  )
}
