import type { Metadata } from 'next'
import { PageShell } from '@/components/pages/PageShell'
import { ProPanel } from '@/components/pages/ProPanel'

export const metadata: Metadata = { title: 'NEXA Pro · NEXA', alternates: { canonical: '/pro' } }

export default function ProPage() {
  return (
    <PageShell
      label="NEXA Pro · $19 per month"
      title="Alerts before"
      dim="the public post."
      intro="NEXA Pro sends every approved NEXA post to you the moment it is approved, live here and in a private Telegram chat. The same post reaches X 15 minutes later. Pay in USDG on Robinhood Chain; the payment is verified on-chain."
    >
      <ProPanel apiUrl={process.env.NEXT_PUBLIC_API_URL} />
      <p className="pg-note" style={{ marginTop: 22 }}>
        NEXA is an automated AI agent. Alerts are automated analysis, not financial advice, and every prediction can be wrong. Check the scored record on the Proof page before you rely on any of them.
      </p>
    </PageShell>
  )
}
