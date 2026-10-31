import type { Metadata } from 'next'
import { AccountPanel } from '@/components/pages/AccountPanel'
import { PageShell } from '@/components/pages/PageShell'

export const metadata: Metadata = { title: 'Account · NEXA', alternates: { canonical: '/account' } }

export default function AccountPage() {
  return (
    <PageShell
      current="/account"
      label="Account"
      title="Your wallet,"
      dim="your benefits."
      intro="Sign in with a wallet to see whether you hold enough $NEXA for holder benefits: earlier alerts and free Ask NEXA reports every month."
    >
      <AccountPanel apiUrl={process.env.NEXT_PUBLIC_API_URL} />
      <p className="pg-note" style={{ marginTop: 22 }}>
        Holding $NEXA is not an investment recommendation, and NEXA never tells anyone to buy it. Benefits can change. Nothing here is financial advice.
      </p>
    </PageShell>
  )
}
