// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Token() {
  return (
    <section className="sec" id="token">
      <div className="head">
        <div data-reveal="">
          <div className="label">
            $NEXA on Pons V2
          </div>
          {" "}
          <h2>
            Fees burn $NEXA.
            <br />
            <span className="dim">
              NEXA never talks up its price.
            </span>
          </h2>
        </div>
        {" "}
        <p className="lede" data-reveal="">
          $NEXA launches in week 9, after NexaLedger and the fee splitter are audited. The opening buy is announced, extra creator tax is 0%, and the burn ratios are hardcoded.
        </p>
      </div>
      {" "}
      <div className="tok">
        <div className="card flow spot" data-reveal="" id="flow1">
          <h3>
            Creator fee
          </h3>
          {" "}
          <p className="src">
            NEXA's share of the 1% fee on every $NEXA trade on Pons.
          </p>
          {" "}
          <div className="bar">
            <span className="burn" data-w="30">
              BurnVault
            </span>
            <span className="rest" data-w="70">
              Treasury
            </span>
          </div>
          {" "}
          <div className="leg">
            <div>
              <b>
                <span data-count="30">
                  0
                </span>
                %
              </b>
              <span>
                burns $NEXA through BurnVault
              </span>
            </div>
            <div>
              <b>
                <span data-count="70">
                  0
                </span>
                %
              </b>
              <span>
                treasury: AI costs, X API, marketing
              </span>
            </div>
          </div>
        </div>
        {" "}
        <div className="card flow spot" data-reveal="" id="flow2">
          <h3>
            Protocol fee
          </h3>
          {" "}
          <p className="src">
            Revenue from Pro, the Signals API, Ask NEXA credits and sponsored reports.
          </p>
          {" "}
          <div className="bar">
            <span className="burn" data-w="20">
              Burn
            </span>
            <span className="rest" data-w="80">
              Operations
            </span>
          </div>
          {" "}
          <div className="leg">
            <div>
              <b>
                <span data-count="20">
                  0
                </span>
                %
              </b>
              <span>
                burns $NEXA through BurnVault
              </span>
            </div>
            <div>
              <b>
                <span data-count="80">
                  0
                </span>
                %
              </b>
              <span>
                operations
              </span>
            </div>
          </div>
        </div>
        {" "}
        <div className="card burn-card" data-reveal="">
          <div className="l">
            <h3 style={{ fontSize: "22px", fontWeight: "400", letterSpacing: "-.02em" }}>
              Why a custom splitter
            </h3>
            {" "}
            <ul>
              <li>
                Pons V2 runs a bonding curve, then graduates to a Uniswap v4 pool that stays locked for good.
              </li>
              {" "}
              <li>
                Pons keeps 30% of the 1% trading fee; the creator gets the rest, paid in the paired asset.
              </li>
              {" "}
              <li>
                Pons' built-in buyback locks tokens for five years and never burns them, so NEXA sends fees through its own CreatorFeeSplitter.
              </li>
              {" "}
              <li>
                A burn tracker page on the web shows every BurnVault transaction.
              </li>
            </ul>
          </div>
          {" "}
          <div className="vault">
            <canvas id="embers" aria-hidden="true" />
            <div className="vl">
              <span>
                BurnVault
              </span>
              <span>
                {"Ratios "}
                <b>
                  hardcoded
                </b>
              </span>
            </div>
          </div>
        </div>
      </div>
      {" "}
      <div className="golden" data-reveal="">
        <b>
          The golden rule:
        </b>
        {" NEXA never discusses the $NEXA price and never tells anyone to buy it. An agent that shills its own token would undo the whole point of Proof of Intelligence."}
      </div>
    </section>
  )
}
