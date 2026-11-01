// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Proof() {
  return (
    <section className="sec" id="proof">
      <div className="head">
        <div data-reveal="">
          <div className="label">
            Proof of Intelligence
          </div>
          {" "}
          <h2>
            A persona you can audit,
            <br />
            <span className="dim">
              call by call.
            </span>
          </h2>
        </div>
        {" "}
        <a href={X_URL} target="_blank" rel="noopener" className="x-btn" aria-label="NEXA on X" data-reveal="">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <use href="#nx-x" />
          </svg>
        </a>
      </div>
      {" "}
      <div className="why">
        <div className="card ledger tilt spot" data-reveal="">
          <div className="lg-top">
            <span className="tag">
              Example commit
            </span>
            <span className="mono net">
              <i />
              NexaLedger · testnet 46630
            </span>
          </div>
          {" "}
          <h3>
            What a call looks like in NexaLedger
          </h3>
          {" "}
          <div className="receipt">
            <div className="rc-head">
              <span className="k">
                Commit hash
              </span>
              <button className="copy" type="button" id="copyHash" aria-label="Copy example hash">
                Copy
              </button>
            </div>
            {" "}
            <div className="hash" id="exHash" />
            {" "}
            <div className="rc-grid">
              <div>
                <span className="k">
                  Asset
                </span>
                <span className="v">
                  <span className="tk">
                    NV
                  </span>
                  NVDA Stock Token
                </span>
              </div>
              {" "}
              <div>
                <span className="k">
                  Direction
                </span>
                <span className="v up">
                  ↑ Up
                </span>
              </div>
              {" "}
              <div>
                <span className="k">
                  Horizon
                </span>
                <span className="v">
                  7 days
                </span>
              </div>
              {" "}
              <div>
                <span className="k">
                  Scored against
                </span>
                <span className="v">
                  Chainlink feed
                </span>
              </div>
            </div>
            {" "}
            <div className="rc-reveal">
              <div className="row">
                <span className="k">
                  Reveal in
                </span>
                <span className="mono-v" id="exCount">
                  4d 00:00:00
                </span>
              </div>
              {" "}
              <div className="pbar">
                <b id="exBar" />
              </div>
            </div>
            {" "}
            <ol className="trail">
              <li className="done">
                Committed
              </li>
              <li className="done">
                Posted on X
              </li>
              <li className="now">
                Revealed
              </li>
              <li>
                Scored
              </li>
            </ol>
          </div>
        </div>
        {" "}
        <div className="why-r">
          <div className="txt" data-reveal="">
            <p>
              {"\"Superintelligence\" is the persona. "}
              <b>
                The record is what you can check:
              </b>
              {" each prediction, its hash, the block it was committed in, and whether it came true. A human KOL can delete a bad call. NEXA's calls sit in a contract."}
            </p>
          </div>
          {" "}
          <div className="mini" data-stagger="">
            <div className="card spot">
              <div>
                <span className="mono">
                  Public win rate
                </span>
                {" "}
                <h4>
                  Scored by the oracle, not by NEXA
                </h4>
              </div>
              {" "}
              <svg className="gauge" viewBox="0 0 200 110" aria-hidden="true">
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#242424" strokeWidth="14" strokeLinecap="round" />
                <path id="gArc" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#FF5A1F" strokeWidth="14" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1" opacity=".25" />
                <text id="gTxt" x="100" y="88" textAnchor="middle" fontFamily="Geist Mono, monospace" fontSize="9" fill="#6E6A66">
                  No scored calls yet
                </text>
              </svg>
              {" "}
              <p>
                Published after the first call is scored. Average return per prediction sits next to it, with a Blockscout link for every commit.
              </p>
            </div>
            {" "}
            <div className="card pod">
              <div>
                <span className="mono">
                  Prediction of the Day
                </span>
                {" "}
                <h4>
                  One call, seven days, one result
                </h4>
              </div>
              {" "}
              <div>
                <div className="pod-big">
                  <em>
                    Day 4
                  </em>
                  <span>
                    of 7
                  </span>
                </div>
                {" "}
                <div className="days" id="days">
                  <i>
                    <b />
                    <span>
                      D1
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D2
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D3
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D4
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D5
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D6
                    </span>
                  </i>
                  <i>
                    <b />
                    <span>
                      D7
                    </span>
                  </i>
                </div>
                {" "}
                <p>
                  reveal() runs at expiry and the outcome joins the public record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
