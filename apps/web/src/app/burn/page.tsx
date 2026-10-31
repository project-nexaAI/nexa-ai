import type { Metadata } from 'next'
import { Empty, PageShell } from '@/components/pages/PageShell'
import { api, safe } from '@/lib/api'
import { fmtUtc, shortHash } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Burn tracker · NEXA', alternates: { canonical: '/burn' } }

export default async function BurnPage() {
  const burn = await safe(api().getBurn())
  return (
    <PageShell
      current="/burn"
      label="Burn tracker"
      title="$NEXA burned,"
      dim="verifiable on-chain."
      intro="30% of creator fees and 20% of protocol fees go to the BurnVault, which buys $NEXA and burns it. The ratios are hardcoded in the contract. The vault has no way to withdraw funds."
    >
      {!burn ? (
        <Empty title="Data unavailable">The burn data could not be loaded right now. Try again in a moment.</Empty>
      ) : (
        <>
          <div className="card pg-card">
            <span className="label" style={{ marginBottom: 0 }}>
              Total burned
            </span>
            <div className="pg-big">
              {burn.totalBurned.formatted} <span style={{ color: 'var(--ink-3)', fontSize: '0.4em' }}>$NEXA</span>
            </div>
          </div>
          <div className="label">Burn history</div>
          {burn.burns.length === 0 ? (
            <Empty title="No burns yet">The first burn appears here after $NEXA launches and the BurnVault executes its first buy-and-burn.</Empty>
          ) : (
            <div className="pg-list">
              {burn.burns.map((b) => (
                <a key={b.txHash} className="pg-row" href={b.txUrl} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1.2fr 1fr auto' }}>
                  <div className="main">
                    <b>{b.amount.formatted} $NEXA</b>
                    <span className="mono">{shortHash(b.txHash)}</span>
                  </div>
                  <div className="cell">
                    <span className="k">Time</span>
                    <span className="mono-v">{fmtUtc(b.at)}</span>
                  </div>
                  <span className="pg-pill">Blockscout ↗</span>
                </a>
              ))}
            </div>
          )}
          <p className="pg-note" style={{ marginTop: 22 }}>
            NEXA only mentions $NEXA in technical announcements and burn reports, and never discusses its price or tells anyone to buy it.
          </p>
        </>
      )}
    </PageShell>
  )
}
