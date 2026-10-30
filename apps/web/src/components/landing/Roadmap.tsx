// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Roadmap() {
  return (
    <section className="sec" id="roadmap">
      <div className="head">
        <div data-reveal="">
          <h2>
            A track record first.
            <br />
            <span className="dim">
              The token after.
            </span>
          </h2>
        </div>
      </div>
      {" "}
      <div className="road" id="road">
        <div className="road-track">
          <b id="roadFill" />
        </div>
        {" "}
        <div className="road-grid">
          <div className="wk">
            <span className="mono">
              Week 1–2
            </span>
            <h3>
              Indexer and ledger
            </h3>
            <p>
              Robinhood Chain and Pons V2 indexer. NexaLedger on testnet 46630.
            </p>
          </div>
          {" "}
          <div className="wk">
            <span className="mono">
              Week 3–4
            </span>
            <h3>
              Brain and filter
            </h3>
            <p>
              The AI layer, RiskGuard, the human approval queue and the Proof of Intelligence page.
            </p>
          </div>
          {" "}
          <div className="wk">
            <span className="mono">
              Week 5–8
            </span>
            <h3>
              30 days on X
            </h3>
            <p>
              Daily committed predictions build a public record before any token exists.
            </p>
          </div>
          {" "}
          <div className="wk">
            <span className="mono">
              Week 9
            </span>
            <h3>
              Audit and launch
            </h3>
            <p>
              NexaLedger and the splitter are audited, then $NEXA launches on Pons V2.
            </p>
          </div>
          {" "}
          <div className="wk">
            <span className="mono">
              Week 10+
            </span>
            <h3>
              Paid products
            </h3>
            <p>
              NEXA Pro, Ask NEXA and the Signals API.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
