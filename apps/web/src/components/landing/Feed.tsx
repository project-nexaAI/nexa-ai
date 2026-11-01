// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import type { MarketResponse, RugRadarResponse } from '@nexa-ai/api-client'
import { fmtAge } from '@/lib/format'
import { chartGeometry } from '@/lib/market-chart'
import { X_URL } from '@/lib/site'

const RADAR_ROWS = 3

/** Kartu data nyata: `market` dari /market (snapshot worker) dan `radar` dari /rug-radar; null = API tidak tersedia. */
export function Feed({ market, radar }: { market: MarketResponse | null; radar: RugRadarResponse | null }) {
  const top = market?.assets.find((a) => a.series.length >= 2) ?? null
  const geo = top ? chartGeometry(top.series, top.oracle.decimals) : null
  const launches = radar?.items.slice(0, RADAR_ROWS) ?? []

  return (
    <section className="sec" id="feed">
      <div className="head center">
        <div data-reveal="">
          <h2>
            What NEXA posts
            <br />
            <span className="dim">
              every day.
            </span>
          </h2>
        </div>
        {" "}
        <p className="lede" data-reveal="">
          {"Robinhood Chain did about "}
          <b>
            $1.49 billion
          </b>
          {" in DEX volume in 24 hours in late August 2026. With that many new tokens, traders need a filter that is fast and keeps its record public."}
        </p>
      </div>
      {" "}
      <div className="bento" data-stagger="">
        <article className="card wide spot">
          <span className="illus">{geo && top ? `Live · ${top.windowHours ?? 'under 1'}h` : 'Collecting data'}</span>
          {" "}
          <h3>
            Stock Token movers
          </h3>
          {" "}
          <p>
            The day's biggest Stock Token moves, and where DEX prices drift away from the Chainlink feed.
          </p>
          {" "}
          <div className="viz">
            {geo && top ? (
              <div className="mkt">
                <div className="mkt-row">
                  <b>{top.symbol}</b>
                  <span>${top.oracle.formatted}</span>
                  {top.changeFormatted ? <span className={(top.changeBps ?? 0) < 0 ? 'dn' : 'up'}>{top.changeFormatted} {top.windowHours}h</span> : null}
                  {top.dex && top.gapFormatted ? <span className="mkt-dex">DEX ${top.dex.formatted} ({top.gapFormatted} vs oracle)</span> : null}
                </div>
                <svg viewBox="0 0 600 150" fill="none" role="img" aria-label={`${top.symbol} price: Chainlink feed and DEX, last 24 hours`}>
                  <defs>
                    <linearGradient id="spr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#FF5A1F" stopOpacity=".35" />
                      <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={geo.area} fill="url(#spr)" />
                  <path className="draw" pathLength="1" d={geo.oracle} stroke="#FF5A1F" strokeWidth="2.5" />
                  {geo.dex ? <path d={geo.dex} stroke="#A7A29C" strokeWidth="1.5" strokeDasharray="4 6" /> : null}
                  <g fontFamily="Geist Mono, monospace" fontSize="11" fill="#6E6A66">
                    <text x="0" y="140">
                      DEX price
                    </text>
                    <text x="110" y="140" fill="#A7A29C">
                      Chainlink feed
                    </text>
                  </g>
                  <circle cx={geo.last.x} cy={geo.last.y} r="5" fill="#FF5A1F" />
                </svg>
              </div>
            ) : (
              <p className="mkt-empty">NEXA is collecting Chainlink and DEX prices. The chart appears once there is history to show.</p>
            )}
          </div>
        </article>
        {" "}
        <article className="card spot">
          <h3>
            Rug radar
          </h3>
          {" "}
          <p>
            Pons V2 launches with red flags, refreshed in real time on the web.
          </p>
          {" "}
          <div className="radar" aria-hidden="true">
            <i style={{ left: "28%", top: "30%" }} />
            <i style={{ left: "66%", top: "62%" }} />
            <i style={{ left: "58%", top: "22%", background: "#6E6A66", boxShadow: "none" }} />
          </div>
        </article>
        {" "}
        <article className="card spot">
          <span className="illus">{launches.length > 0 ? 'Live' : 'No data yet'}</span>
          {" "}
          <h3>
            Pons V2 launches
          </h3>
          {" "}
          <p>
            The busiest launches and graduations, with red flags called out.
          </p>
          {" "}
          <div className="viz">
            {launches.length > 0 ? (
              <div className="rows">
                {launches.map((t) => (
                  <div key={t.token}>
                    <span className="av">{(t.symbol ?? '?').slice(0, 1).toUpperCase()}</span>
                    <span className="nm">
                      {t.symbol ?? 'Unknown'}
                      <small>{fmtAge(t.ageSeconds)}</small>
                    </span>
                    {t.redFlags.length > 0 ? <span className="flag">{t.redFlags[0]}</span> : <span className="flag ok">{t.graduated ? 'Graduated' : 'No flags'}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mkt-empty">No Pons V2 launches indexed yet. New launches show up here within seconds.</p>
            )}
          </div>
        </article>
        {" "}
        <article className="card spot">
          <h3>
            Prediction of the Day
          </h3>
          {" "}
          <p>
            One call a day, committed on-chain first and scored seven days later against the oracle price.
          </p>
          {" "}
          <div className="viz">
            <svg viewBox="0 0 300 120" fill="none" aria-hidden="true">
              <g stroke="#333" strokeWidth="1.5">
                <rect x="10" y="40" width="70" height="44" rx="10" />
                <rect x="115" y="40" width="70" height="44" rx="10" />
                <rect x="220" y="40" width="70" height="44" rx="10" stroke="#FF5A1F" />
              </g>
              <path className="draw" pathLength="1" d="M80 62h35M185 62h35" stroke="#FF5A1F" strokeWidth="2" />
              <g fontFamily="Geist Mono, monospace" fontSize="10" fill="#A7A29C" textAnchor="middle">
                <text x="45" y="66">
                  commit
                </text>
                <text x="150" y="66">
                  post
                </text>
                <text x="255" y="66" fill="#FF7A3D">
                  reveal
                </text>
              </g>
              <g fontFamily="Geist Mono, monospace" fontSize="9.5" fill="#6E6A66" textAnchor="middle">
                <text x="45" y="104">
                  day 0
                </text>
                <text x="150" y="104">
                  day 0
                </text>
                <text x="255" y="104">
                  day 7
                </text>
              </g>
            </svg>
          </div>
        </article>
        {" "}
        <article className="card spot">
          <span className="illus">
            Example
          </span>
          {" "}
          <h3>
            Mentions
          </h3>
          {" "}
          <p>
            Tag NEXA with a contract address and get a risk summary back.
          </p>
          {" "}
          <div className="viz">
            <div className="chat">
              <div className="bub q">
                <span className="who">
                  Trader
                </span>
                @nexa check contract 0x…
              </div>
              {" "}
              <div className="bub a">
                <span className="who">
                  NEXA · AI agent
                </span>
                Risk summary: ownership, holder spread, creator tax. Not financial advice.
              </div>
            </div>
          </div>
        </article>
        {" "}
        <article className="card full">
          <div>
            <h3>
              Calls go public on X. Pro gets them 15 minutes sooner.
            </h3>
            {" "}
            <p>
              Posts carry no links, because link posts cost more than 13 times as much on the X API. The web holds the links and the proof.
            </p>
          </div>
          {" "}
          <a href={X_URL} target="_blank" rel="noopener" className="btn btn-light magnet">
            {"Follow on X "}
            <span className="ar">
              →
            </span>
          </a>
        </article>
      </div>
    </section>
  )
}
