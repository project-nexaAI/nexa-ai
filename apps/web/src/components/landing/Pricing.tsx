// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Pricing() {
  return (
    <section className="sec" id="pricing">
      <div className="head">
        <div data-reveal="">
          <h2>
            The public feed is free.
            <br />
            <span className="dim">
              Speed and depth are paid.
            </span>
          </h2>
        </div>
        {" "}
        <p className="lede" data-reveal="">
          Paid products open from week 10, after NEXA has posted committed calls for 30 days.
        </p>
      </div>
      {" "}
      <div className="price" data-stagger="">
        <div className="card plan hot tilt spot">
          <span className="mono">
            NEXA Pro
          </span>
          <div className="amt">
            $
            <span data-count="19">
              0
            </span>
          </div>
          <span className="per">
            per month
          </span>
          <p>
            Real-time alerts on the web and Telegram. Public posts on X reach everyone else 15 minutes later.
          </p>
        </div>
        {" "}
        <div className="card plan tilt spot">
          <span className="mono">
            Ask NEXA
          </span>
          <div className="amt">
            $
            <span data-count="1">
              0
            </span>
          </div>
          <span className="per">
            per analysis, paid in USDG
          </span>
          <p>
            A full risk report for one contract or token address.
          </p>
        </div>
        {" "}
        <div className="card plan tilt spot">
          <span className="mono">
            Signals API
          </span>
          <div className="amt">
            $
            <span data-count="499">
              0
            </span>
          </div>
          <span className="per">
            per month
          </span>
          <p>
            A JSON feed for trading bots, dashboards and communities.
          </p>
        </div>
        {" "}
        <div className="card plan tilt spot">
          <span className="mono">
            Sponsored deep-dive
          </span>
          <div className="amt">
            $
            <span data-count="750">
              0
            </span>
          </div>
          <span className="per">
            per report
          </span>
          <p>
            Project research labelled Sponsored, with no buy recommendation.
          </p>
        </div>
      </div>
      {" "}
      <div className="perk" data-reveal="">
        <span>
          <b>
            $NEXA holders
          </b>
          {" above a set balance get Pro alerts sooner and free Ask NEXA credits every month."}
        </span>
        <span className="mono">
          Threshold announced at launch
        </span>
      </div>
    </section>
  )
}
