import type { Metadata } from 'next'
import { AskForm } from '@/components/pages/AskForm'
import { PageShell } from '@/components/pages/PageShell'

export const metadata: Metadata = { title: 'Ask NEXA · NEXA', alternates: { canonical: '/ask' } }

// Alamat pembayaran publik (treasury), diisi lewat env bila Ask NEXA dibuka.
const PAY_TO = process.env.NEXT_PUBLIC_ASK_PAYMENT_ADDRESS

export default function AskPage() {
  return (
    <PageShell
      current="/ask"
      label="Ask NEXA · $1 per report"
      title="A risk summary"
      dim="for any token, on demand."
      intro="Paste a token address and pay $1 in USDG on Robinhood Chain. The payment is verified on-chain before anything runs, and the summary is built only from data NEXA has indexed. If the data is not there, it says it does not know."
    >
      <div className="card pg-card">
        <span className="label" style={{ marginBottom: 0 }}>
          How it works
        </span>
        <ol className="pg-steps">
          <li>
            Send $1 in USDG to {PAY_TO ? <span className="mono-v">{PAY_TO}</span> : 'the payment address (shown when Ask NEXA opens)'} on Robinhood Chain.
          </li>
          <li>Copy the transaction hash once it is confirmed.</li>
          <li>Paste the token address and the hash below. One payment covers one report.</li>
        </ol>
      </div>
      <AskForm apiUrl={process.env.NEXT_PUBLIC_API_URL} />
      <p className="pg-note" style={{ marginTop: 22 }}>
        Tokens younger than one hour are not analyzed, and the payment is not used in that case. Reports are automated summaries of on-chain data, not financial advice.
      </p>
    </PageShell>
  )
}
