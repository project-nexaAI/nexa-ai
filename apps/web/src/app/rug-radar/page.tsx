import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AutoRefresh } from '@/components/pages/AutoRefresh'
import { Empty, PageShell } from '@/components/pages/PageShell'
import { apiForChain, hasElysium, safe } from '@/lib/api'
import { ChainPicker } from '@/components/pages/ChainPicker'
import { bpsText, fmtAge } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Rug radar · NEXA', alternates: { canonical: '/rug-radar' } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function RugRadarPage(props: Props) {
  const rawParams = await Promise.resolve(props.searchParams)
  const chain = typeof rawParams.chain === 'string' ? rawParams.chain : undefined
  const radar = await safe(apiForChain(chain).getRugRadar())
  const elysiumEnabled = hasElysium()
  const chainLabel = chain === 'elysium-testnet' ? 'Elysium' : 'Robinhood Chain'
  return (
    <PageShell
      label="Rug radar"
      title="New launches,"
      dim="with the red flags up front."
      intro={`Live launches on ${chainLabel}, read straight from the chain. Creator tax and holder concentration are flagged. NEXA does not discuss tokens younger than one hour in its posts.`}
    >
      <Suspense>
        <ChainPicker elysiumEnabled={elysiumEnabled} />
      </Suspense>
      <AutoRefresh seconds={15} />
      {!radar ? (
        <Empty title="Data unavailable">The radar could not be loaded right now. Try again in a moment.</Empty>
      ) : radar.items.length === 0 ? (
        <Empty title="No launches indexed yet">New Pons V2 launches show up here within seconds of appearing on-chain.</Empty>
      ) : (
        <>
          <div className="label">
            <span className="pg-live">Live · {radar.items.length} recent launches</span>
          </div>
          <div className="pg-list">
            {radar.items.map((t) => (
              <a key={t.token} className="pg-row" href={t.explorerUrl} target="_blank" rel="noopener">
                <div className="main">
                  <b>{t.symbol ?? 'Unknown'}</b>
                  <span>{t.name ?? t.token}</span>
                </div>
                <div className="cell">
                  <span className="k">Age</span>
                  <span className="mono-v">{fmtAge(t.ageSeconds)}</span>
                </div>
                <div className="cell">
                  <span className="k">Creator tax</span>
                  <span className="mono-v">{bpsText(t.creatorTaxBps)}</span>
                </div>
                <div className="cell">
                  <span className="k">Top holder</span>
                  <span className="mono-v">{bpsText(t.topHolderShareBps)}</span>
                </div>
                <div className="pg-flags">
                  {t.graduated ? <span className="pg-flag ok">Graduated</span> : null}
                  {t.redFlags.length === 0 ? (
                    <span className="pg-flag ok">No flags</span>
                  ) : (
                    t.redFlags.map((f) => (
                      <span key={f} className="pg-flag">
                        {f}
                      </span>
                    ))
                  )}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
      <p className="pg-note" style={{ marginTop: 22 }}>
        Flags are automated signals from on-chain data, not a verdict. “n/a” means the value is not known yet. Nothing here is financial advice.
      </p>
    </PageShell>
  )
}
