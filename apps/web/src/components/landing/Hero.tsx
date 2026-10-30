// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="stage">
        <canvas id="hero3d" aria-hidden="true" />
        {" "}
        <div className="prog" aria-hidden="true">
          <i>
            <b />
          </i>
          <i>
            <b />
          </i>
        </div>
        {" "}
        <div className="stage-inner">
          <div className="copy-a" id="copyA">
            <div className="tagrow">
              <span className="av">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <use href="#nx-mark" />
                </svg>
              </span>
              <span>
                AI agent on Robinhood Chain
                <br />
                <span className="mono">
                  Automated account on X
                </span>
              </span>
            </div>
            {" "}
            <h1 className="split" data-split="">
              {"The superintelligence influencer. "}
              <em className="s">
                No deleted tweets.
              </em>
            </h1>
            {" "}
            <p className="sub">
              NEXA reads Robinhood Chain around the clock and posts what it finds on X. Each prediction is hashed into the NexaLedger contract before it goes out, and scored against the oracle price when it expires.
            </p>
            {" "}
            <div className="cta-row">
              <a href={X_URL} target="_blank" rel="noopener" className="btn btn-org magnet">
                {"Follow on X "}
                <span className="ar">
                  →
                </span>
              </a>
              {" "}
              <a href="#how" className="btn btn-ghost magnet">
                How a call is proved
              </a>
            </div>
          </div>
          {" "}
          <div className="copy-b" id="copyB">
            <div className="label">
              Proof of Intelligence
            </div>
            {" "}
            <h2>
              {"The hash lands on-chain "}
              <span className="dim">
                before the post lands on X.
              </span>
            </h2>
            {" "}
            <code>
              NexaLedger.commit(keccak(text, asset, direction, horizon, salt))
            </code>
          </div>
          {" "}
          <div className="stage-foot">
            <div className="hstats">
              <div className="hstat">
                <div className="n">
                  1
                  <small>
                    / day
                  </small>
                </div>
                <p>
                  Prediction of the Day, committed on-chain
                </p>
              </div>
              {" "}
              <div className="hstat org">
                <div className="n">
                  7
                  <small>
                    days
                  </small>
                </div>
                <p>
                  until each call is revealed and scored
                </p>
              </div>
            </div>
            {" "}
            <div className="reads">
              <span className="mono">
                Reads from
              </span>
              {" "}
              <ul>
                <li>
                  Envio HyperSync
                </li>
                <li>
                  Chainlink Data Feeds
                </li>
                <li>
                  Pons V2
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
