import type { AskResponse } from '@nexa-ai/api-client'
import { bpsText, fmtAge } from '@/lib/format'

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
const utc = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'n/a')
const LEVEL_TEXT = { ok: 'OK', watch: 'Watch', risk: 'Risk', unknown: 'Unknown' } as const
const RISK_TEXT = { low: 'Low', medium: 'Medium', high: 'High', unknown: 'Not enough data' } as const

/** Laporan Ask NEXA lengkap. Semua nilai berasal dari data indexer; penilaian memakai aturan tetap di API. */
export function AskReport({ result }: { result: AskResponse }) {
  const r = result.report
  const d = r.details
  const unit = d.pair?.symbol ?? 'pair token'
  return (
    <div className="card pg-card" style={{ marginTop: 20 }} aria-live="polite">
      <span className="label" style={{ marginBottom: 0 }}>
        Risk report
      </span>
      <h3>
        {r.symbol ?? 'Unknown token'} {r.name ? `· ${r.name}` : ''}
      </h3>

      <div className={`pg-level ${r.riskLevel}`}>
        <span className="k">Overall signal level</span>
        <b>{RISK_TEXT[r.riskLevel]}</b>
        <span className="pg-note" style={{ margin: 0 }}>
          A fixed-rule summary of the signals below. It is not a prediction and not advice.
        </span>
      </div>

      <div className="pg-kv">
        <div>
          <span className="k">Age</span>
          <span className="v">{fmtAge(r.ageSeconds)}</span>
        </div>
        <div>
          <span className="k">Graduated</span>
          <span className="v">{r.graduated ? `Yes (${utc(d.graduatedAt)})` : 'No'}</span>
        </div>
        <div>
          <span className="k">Creator tax</span>
          <span className="v">{bpsText(r.creatorTaxBps)}</span>
        </div>
        <div>
          <span className="k">Top holder share</span>
          <span className="v">{bpsText(r.topHolderShareBps)}</span>
        </div>
        <div>
          <span className="k">Trades (buys · sells)</span>
          <span className="v">
            {r.trades.total} ({r.trades.buys} · {r.trades.sells})
          </span>
        </div>
        <div>
          <span className="k">Launched</span>
          <span className="v">{utc(d.launchedAt)}</span>
        </div>
      </div>

      <span className="label" style={{ marginBottom: 0 }}>
        Signals
      </span>
      <div className="pg-signals">
        {r.signals.map((s) => (
          <div key={s.id} className={`pg-sig ${s.level}`}>
            <div className="top">
              <b>{s.label}</b>
              <span className="lv">{LEVEL_TEXT[s.level]}</span>
            </div>
            <span className="val">{s.value}</span>
            <span className="note">{s.note}</span>
          </div>
        ))}
      </div>

      <span className="label" style={{ marginBottom: 0 }}>
        Trading activity
      </span>
      <div className="pg-kv">
        <div>
          <span className="k">Unique traders</span>
          <span className="v">
            {d.activity.uniqueTraders} ({d.activity.uniqueBuyers} buying · {d.activity.uniqueSellers} selling)
          </span>
        </div>
        <div>
          <span className="k">Trades last 1h · 24h</span>
          <span className="v">
            {d.activity.tradesLast1h} · {d.activity.tradesLast24h}
          </span>
        </div>
        <div>
          <span className="k">First · last trade</span>
          <span className="v">
            {utc(d.activity.firstTradeAt)} · {utc(d.activity.lastTradeAt)}
          </span>
        </div>
        <div>
          <span className="k">Buy volume</span>
          <span className="v">
            {d.activity.volume.buyFormatted} {unit}
          </span>
        </div>
        <div>
          <span className="k">Sell volume</span>
          <span className="v">
            {d.activity.volume.sellFormatted} {unit}
          </span>
        </div>
        <div>
          <span className="k">Net flow (buy minus sell)</span>
          <span className="v">
            {d.activity.volume.netFormatted} {unit}
          </span>
        </div>
        {d.activity.largestTrade ? (
          <div>
            <span className="k">Largest trade</span>
            <span className="v">
              {d.activity.largestTrade.side} · {d.activity.largestTrade.quoteFormatted} {unit}
            </span>
          </div>
        ) : null}
      </div>

      <span className="label" style={{ marginBottom: 0 }}>
        Creator wallet
      </span>
      <div className="pg-kv">
        <div>
          <span className="k">Address</span>
          <a className="v pg-link" href={d.creator.url} target="_blank" rel="noopener">
            {short(d.creator.address)}
          </a>
        </div>
        <div>
          <span className="k">Own trades (buys · sells)</span>
          <span className="v">
            {d.creatorActivity.trades} ({d.creatorActivity.buys} · {d.creatorActivity.sells})
          </span>
        </div>
        <div>
          <span className="k">Sold by creator</span>
          <span className="v">
            {d.creatorActivity.soldFormatted} {unit}
          </span>
        </div>
      </div>

      {d.holders ? (
        <>
          <span className="label" style={{ marginBottom: 0 }}>
            Holders
          </span>
          <div className="pg-kv">
            <div>
              <span className="k">Holders with a balance</span>
              <span className="v">{d.holders.count}</span>
            </div>
            <div>
              <span className="k">Top 5 · top 10 share</span>
              <span className="v">
                {bpsText(d.holders.top5ShareBps)} · {bpsText(d.holders.top10ShareBps)}
              </span>
            </div>
          </div>
          <div className="pg-holders">
            {d.holders.top.map((h, i) => (
              <a key={h.address} href={h.url} target="_blank" rel="noopener">
                <span>{i + 1}</span>
                <span>{short(h.address)}</span>
                <span>{bpsText(h.shareBps)}</span>
              </a>
            ))}
          </div>
          <p className="pg-note">The bonding curve and pool contracts are left out of the ranking.</p>
        </>
      ) : null}

      <span className="label" style={{ marginBottom: 0 }}>
        On-chain links
      </span>
      <div className="pg-links">
        <a className="pg-link" href={d.token.url} target="_blank" rel="noopener">
          Token on Blockscout ↗
        </a>
        {d.curve ? (
          <a className="pg-link" href={d.curve.url} target="_blank" rel="noopener">
            Bonding curve ↗
          </a>
        ) : null}
        {d.pair ? (
          <a className="pg-link" href={`${d.token.url.replace(/\/address\/.*$/, '')}/address/${d.pair.address}`} target="_blank" rel="noopener">
            Pair asset ({unit}) ↗
          </a>
        ) : null}
      </div>

      <div className="pg-flags">
        {r.redFlags.length === 0 ? (
          <span className="pg-flag ok">No red flags found</span>
        ) : (
          r.redFlags.map((f) => (
            <span key={f} className="pg-flag">
              {f}
            </span>
          ))
        )}
      </div>
      {r.unknowns.length > 0 ? <p className="pg-note">Not known yet: {r.unknowns.join('; ')}.</p> : null}
      <p className="pg-note">{r.disclaimer}</p>
      {result.paymentTxUrl ? (
        <a className="pg-link" href={result.paymentTxUrl} target="_blank" rel="noopener">
          Payment on Blockscout ↗
        </a>
      ) : (
        <p className="pg-note">Free holder credit used.</p>
      )}
    </div>
  )
}
