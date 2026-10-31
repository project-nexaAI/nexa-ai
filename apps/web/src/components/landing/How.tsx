// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function How() {
  return (
    <section className="sec" id="how">
      <div className="head">
        <div data-reveal="">
          <h2>
            From chain data
            <br />
            <span className="dim">
              to a scored call.
            </span>
          </h2>
        </div>
        {" "}
        <p className="lede" data-reveal="">
          Nothing leaves NEXA until it passes RiskGuard. A prediction also has to be recorded in NexaLedger before it can be posted.
        </p>
      </div>
      {" "}
      <div className="pipe" id="pipe">
        <div className="pipe-line">
          <b id="pipeFill" />
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              Read
            </h3>
            {" "}
            <p>
              An Envio HyperSync indexer follows Pons V2 launches, trades and graduations, whale transfers and Stock Token prices. Chainlink Data Feeds supply the official prices used for analysis and scoring.
            </p>
            {" "}
            <div className="chips">
              <span>
                Envio HyperSync
              </span>
              <span>
                Pons V2 events
              </span>
              <span>
                Chainlink Data Feeds
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              Indexer
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <g fontFamily="Geist Mono, monospace" fontSize="8" letterSpacing=".08em" fill="#6E6A66">
                <text x="16" y="49">
                  LAUNCH
                </text>
                <text x="16" y="79">
                  TRADE
                </text>
                <text x="16" y="109">
                  PRICE
                </text>
              </g>
              <path d="M62 46H214M62 76H214M62 106H214" stroke="#262626" strokeWidth="1.5" strokeDasharray="2 4" />
              <rect y="42" width="20" height="8" rx="4" fill="#FF5A1F">
                <animate attributeName="x" values="56;200" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.85;1" dur="2.4s" repeatCount="indefinite" />
              </rect>
              <rect y="42" width="12" height="8" rx="4" fill="#FF5A1F">
                <animate attributeName="x" values="56;200" dur="2.4s" begin="-1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;.55;.55;0" keyTimes="0;.12;.85;1" dur="2.4s" begin="-1.2s" repeatCount="indefinite" />
              </rect>
              <rect y="72" width="16" height="8" rx="4" fill="#FF7A3D">
                <animate attributeName="x" values="56;200" dur="1.8s" begin="-.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.85;1" dur="1.8s" begin="-.4s" repeatCount="indefinite" />
              </rect>
              <rect y="102" width="24" height="8" rx="4" fill="#FFB067">
                <animate attributeName="x" values="56;196" dur="3s" begin="-2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.85;1" dur="3s" begin="-2s" repeatCount="indefinite" />
              </rect>
              <rect x="222" y="30" width="62" height="92" rx="12" fill="#141414" stroke="#3A3A3A" />
              <rect x="222" y="30" width="62" height="92" rx="12" stroke="#FF5A1F" opacity="0">
                <animate attributeName="opacity" values="0;.7;0" dur="2.4s" repeatCount="indefinite" />
              </rect>
              <g fill="#262626">
                <rect x="234" y="46" width="38" height="5" rx="2.5" />
                <rect x="234" y="58" width="28" height="5" rx="2.5" />
                <rect x="234" y="70" width="34" height="5" rx="2.5" />
              </g>
              <circle cx="253" cy="90" r="3.5" fill="#FF5A1F">
                <animate attributeName="r" values="2.5;4.5;2.5" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <text x="253" y="112" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="7.5" fill="#A7A29C" letterSpacing=".1em">
                HYPERSYNC
              </text>
            </svg>
          </div>
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              Think
            </h3>
            {" "}
            <p>
              A language model with tool calls writes the analysis from indexer and oracle data only. When the data is incomplete, NEXA says it doesn't know.
            </p>
            {" "}
            <div className="chips">
              <span>
                LLM API
              </span>
              <span>
                Tool calling
              </span>
              <span>
                No guessing
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              Model
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="tkG" x1="0" x2="1">
                  <stop offset="0" stopColor="#E3341B" />
                  <stop offset=".5" stopColor="#FFD2B5" />
                  <stop offset="1" stopColor="#E3341B" />
                </linearGradient>
              </defs>
              <g stroke="#2A2A2A" strokeWidth="1.2">
                <path id="tkA" d="M40 38 C90 38 100 75 124 75" />
                <path id="tkB" d="M40 75 H124" />
                <path id="tkC" d="M40 112 C90 112 100 75 124 75" />
                <path id="tkD" d="M176 75 C202 75 212 48 260 48" />
                <path id="tkE" d="M176 75 C202 75 212 102 260 102" />
              </g>
              <g fill="#151515" stroke="#3A3A3A">
                <circle cx="40" cy="38" r="7" />
                <circle cx="40" cy="75" r="7" />
                <circle cx="40" cy="112" r="7" />
                <circle cx="260" cy="48" r="7" />
                <circle cx="260" cy="102" r="7" />
              </g>
              <circle r="2.6" fill="#FFB067">
                <animateMotion dur="1.6s" repeatCount="indefinite">
                  <mpath href="#tkA" />
                </animateMotion>
              </circle>
              <circle r="2.6" fill="#FFB067">
                <animateMotion dur="1.6s" begin="-.5s" repeatCount="indefinite">
                  <mpath href="#tkB" />
                </animateMotion>
              </circle>
              <circle r="2.6" fill="#FFB067">
                <animateMotion dur="1.6s" begin="-1s" repeatCount="indefinite">
                  <mpath href="#tkC" />
                </animateMotion>
              </circle>
              <circle r="2.6" fill="#FF5A1F">
                <animateMotion dur="1.8s" begin="-.3s" repeatCount="indefinite">
                  <mpath href="#tkD" />
                </animateMotion>
              </circle>
              <circle r="2.6" fill="#FF5A1F">
                <animateMotion dur="1.8s" begin="-1.2s" repeatCount="indefinite">
                  <mpath href="#tkE" />
                </animateMotion>
              </circle>
              <circle cx="150" cy="75" r="33" stroke="#FF5A1F" strokeOpacity=".3" strokeDasharray="2 4">
                <animateTransform attributeName="transform" type="rotate" from="0 150 75" to="360 150 75" dur="14s" repeatCount="indefinite" />
              </circle>
              <circle cx="150" cy="75" r="26" fill="#0D0D0D" stroke="#3A3A3A" />
              <rect x="128" y="71" width="44" height="8" rx="4" fill="url(#tkG)">
                <animate attributeName="opacity" values=".65;1;.65" dur="2s" repeatCount="indefinite" />
              </rect>
            </svg>
          </div>
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              {"Filter "}
              <code>
                RiskGuard
              </code>
            </h3>
            {" "}
            <p>
              RiskGuard is code, separate from the model. It blocks buy and sell wording, price targets, tokens younger than one hour, and any post missing the disclaimer.
            </p>
            {" "}
            <div className="chips">
              <span>
                Rule-based
              </span>
              <span>
                Blocks shilling
              </span>
              <span>
                Disclaimer enforced
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              RiskGuard
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <defs>
                <clipPath id="shC">
                  <path d="M206 22 L244 36 V70 C244 96 228 112 206 122 C184 112 168 96 168 70 V36Z" />
                </clipPath>
                <linearGradient id="shS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF5A1F" stopOpacity="0" />
                  <stop offset="1" stopColor="#FF5A1F" stopOpacity=".45" />
                </linearGradient>
              </defs>
              <g fontFamily="Geist Mono, monospace" fontSize="10" fill="#8A847E">
                <text x="22" y="50">
                  "buy now"
                </text>
                <text x="22" y="78">
                  target $10
                </text>
                <text x="22" y="106">
                  token age 12m
                </text>
              </g>
              <g stroke="#E3341B" strokeWidth="1.6" strokeLinecap="round">
                <path d="M20 46.5H76" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;.2;.85;1" dur="4s" repeatCount="indefinite" />
                </path>
                <path d="M20 74.5H84" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;.1;.3;.85;1" dur="4s" repeatCount="indefinite" />
                </path>
                <path d="M20 102.5H104" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;.2;.4;.85;1" dur="4s" repeatCount="indefinite" />
                </path>
              </g>
              <path d="M118 75 H158" stroke="#2A2A2A" strokeDasharray="2 4" />
              <path d="M206 22 L244 36 V70 C244 96 228 112 206 122 C184 112 168 96 168 70 V36Z" fill="#120A07" stroke="#4A2A1C" strokeWidth="1.5" />
              <g clipPath="url(#shC)">
                <rect x="160" y="-30" width="100" height="30" fill="url(#shS)">
                  <animate attributeName="y" values="-30;125" dur="2.6s" repeatCount="indefinite" />
                </rect>
              </g>
              <path d="M192 72 l10 10 20 -22" stroke="#FF5A1F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;.42;.56;.9;1" dur="4s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              {"Commit "}
              <code>
                NexaLedger
              </code>
            </h3>
            {" "}
            <p>
              The hash of text, asset, direction, horizon and a secret salt goes into NexaLedger.commit(). The salt stays private until reveal, so nobody can copy the call before it is proven.
            </p>
            {" "}
            <div className="chips">
              <span>
                keccak256
              </span>
              <span>
                Commit-reveal
              </span>
              <span>
                Solidity
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              NexaLedger
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <path d="M40 80 H242" stroke="#262626" strokeWidth="1.5" />
              <g stroke="#333" fill="#121212">
                <rect x="18" y="58" width="44" height="44" rx="9" />
                <rect x="84" y="58" width="44" height="44" rx="9" />
                <rect x="150" y="58" width="44" height="44" rx="9" />
              </g>
              <rect x="216" y="54" width="52" height="52" rx="10" fill="#1A0B05" stroke="#FF5A1F" strokeWidth="1.8">
                <animate attributeName="stroke-opacity" values=".35;1;.35" dur="2.4s" repeatCount="indefinite" />
              </rect>
              <circle r="3" fill="#FFB067">
                <animateMotion dur="2.4s" repeatCount="indefinite" path="M40 80 H242" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <g fontFamily="Geist Mono, monospace" fontSize="8.5" fill="#6E6A66" textAnchor="middle">
                <text x="40" y="83">
                  block
                </text>
                <text x="106" y="83">
                  block
                </text>
                <text x="172" y="83">
                  block
                </text>
              </g>
              <text x="242" y="78" fontFamily="Geist Mono, monospace" fontSize="10" fill="#FF7A3D" textAnchor="middle">
                0x9f…
              </text>
              <text x="242" y="92" fontFamily="Geist Mono, monospace" fontSize="7.5" fill="#C79A80" textAnchor="middle">
                salt ●●●
              </text>
              <text x="150" y="132" fontFamily="Geist Mono, monospace" fontSize="8" fill="#6E6A66" textAnchor="middle" letterSpacing=".08em">
                COMMIT → POST → REVEAL
              </text>
            </svg>
          </div>
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              Post
            </h3>
            {" "}
            <p>
              The post goes out on X without links, since link posts cost far more on the X API. Pro subscribers see it in real time on the web and Telegram; the public sees it 15 minutes later.
            </p>
            {" "}
            <div className="chips">
              <span>
                X API
              </span>
              <span>
                Post and reply only
              </span>
              <span>
                Telegram
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              X API
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <rect x="30" y="30" width="176" height="80" rx="14" fill="#141414" stroke="#3A3A3A" />
              <circle cx="54" cy="54" r="11" fill="#2A2A2C" />
              <rect x="44" y="51" width="20" height="5" rx="2.5" fill="#FF5A1F" />
              <rect x="72" y="47" width="60" height="6" rx="3" fill="#3A3A3A" />
              <rect x="72" y="58" width="36" height="5" rx="2.5" fill="#262626" />
              <rect x="46" y="77" height="6" rx="3" fill="#333" width="0">
                <animate attributeName="width" values="0;140;140;0" keyTimes="0;.35;.9;1" dur="4s" repeatCount="indefinite" />
              </rect>
              <rect x="46" y="89" height="6" rx="3" fill="#333" width="0">
                <animate attributeName="width" values="0;0;96;96;0" keyTimes="0;.2;.5;.9;1" dur="4s" repeatCount="indefinite" />
              </rect>
              <g transform="translate(220 30)">
                <rect width="62" height="22" rx="11" fill="#111" stroke="#333" />
                <text x="31" y="14.5" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="7.5" fill="#A7A29C">
                  NO LINKS
                </text>
              </g>
              <rect x="188" y="96" width="94" height="40" rx="10" fill="#1A0B05" stroke="#FF5A1F" strokeOpacity=".6" />
              <text x="235" y="112" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="8" fill="#FF7A3D" letterSpacing=".08em">
                PRO · LIVE
              </text>
              <text x="235" y="126" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="7.5" fill="#8A847E">
                public +15 min
              </text>
            </svg>
          </div>
        </div>
        {" "}
        <div className="step">
          <div>
            <h3>
              Score
            </h3>
            {" "}
            <p>
              At expiry, reveal() checks the call against the oracle price. The result feeds the public win rate on the Proof of Intelligence page.
            </p>
            {" "}
            <div className="chips">
              <span>
                reveal()
              </span>
              <span>
                Oracle price
              </span>
              <span>
                Blockscout link
              </span>
            </div>
          </div>
          {" "}
          <div className="tile">
            <span className="tl">
              Oracle
            </span>
            <svg viewBox="0 0 300 150" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="gaG" x1="0" x2="1">
                  <stop offset="0" stopColor="#C22E10" />
                  <stop offset=".6" stopColor="#FF5A1F" />
                  <stop offset="1" stopColor="#FFB067" />
                </linearGradient>
              </defs>
              <g stroke="#333" strokeWidth="1.5" strokeLinecap="round">
                <path d="M58 120H51M65 84.8L58.5 82.1M85 55L80 50M114.8 35L112.1 28.5M150 28V21M185.2 35L187.9 28.5M215 55L220 50M235 84.8L241.5 82.1M242 120H249" />
              </g>
              <path d="M70 120 A80 80 0 0 1 230 120" stroke="#222" strokeWidth="12" strokeLinecap="round" />
              <path d="M70 120 A80 80 0 0 1 230 120" stroke="url(#gaG)" strokeWidth="12" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
                <animate attributeName="stroke-dashoffset" values="1;.32;.32;1" keyTimes="0;.4;.85;1" dur="5s" repeatCount="indefinite" />
              </path>
              <g>
                <line x1="150" y1="120" x2="150" y2="58" stroke="#F2EFEA" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="150" cy="120" r="6" fill="#F2EFEA" />
                <animateTransform attributeName="transform" type="rotate" values="-90 150 120;32 150 120;32 150 120;-90 150 120" keyTimes="0;.4;.85;1" dur="5s" repeatCount="indefinite" />
              </g>
              <text x="150" y="144" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="8" fill="#6E6A66" letterSpacing=".08em">
                REVEAL() VS ORACLE PRICE
              </text>
            </svg>
          </div>
        </div>
      </div>
      {" "}
      <div className="hitl" data-reveal="">
        <b>
          First 30 days:
        </b>
        {" a person approves every post before it goes out. After the filter proves stable, only risky replies still need approval."}
      </div>
    </section>
  )
}
