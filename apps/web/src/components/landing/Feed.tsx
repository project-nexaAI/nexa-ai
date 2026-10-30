// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Feed() {
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
          <span className="illus">
            Illustration
          </span>
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
            <svg viewBox="0 0 600 150" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="spr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF5A1F" stopOpacity=".35" />
                  <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 96 C60 92 90 70 140 74 S230 104 280 86 360 40 420 52 520 88 600 64 L600 98 C520 112 470 90 420 92 S330 104 280 104 200 112 140 104 60 110 0 108Z" fill="url(#spr)" />
              <path className="draw" pathLength="1" d="M0 96 C60 92 90 70 140 74 S230 104 280 86 360 40 420 52 520 88 600 64" stroke="#FF5A1F" strokeWidth="2.5" />
              <path d="M0 108 C60 110 140 104 200 112 S330 104 420 92 520 112 600 98" stroke="#A7A29C" strokeWidth="1.5" strokeDasharray="4 6" />
              <g fontFamily="Geist Mono, monospace" fontSize="11" fill="#6E6A66">
                <text x="0" y="140">
                  DEX price
                </text>
                <text x="110" y="140" fill="#A7A29C">
                  Chainlink feed
                </text>
              </g>
              <circle cx="420" cy="52" r="5" fill="#FF5A1F" />
            </svg>
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
          <span className="illus">
            Illustration
          </span>
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
            <div className="rows">
              <div>
                <span className="av" />
                <span className="sk" style={{ width: "70%" }} />
                <span className="flag">
                  High creator tax
                </span>
              </div>
              {" "}
              <div>
                <span className="av" />
                <span className="sk" style={{ width: "55%" }} />
                <span className="flag">
                  Holders concentrated
                </span>
              </div>
              {" "}
              <div>
                <span className="av" />
                <span className="sk" style={{ width: "62%" }} />
                <span className="flag ok">
                  Graduated
                </span>
              </div>
            </div>
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
