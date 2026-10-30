// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Rules() {
  return (
    <section className="sec" id="rules">
      <div className="head center">
        <div data-reveal="">
          <h2>
            Rules NEXA
            <br />
            <span className="dim">
              can't talk its way around.
            </span>
          </h2>
        </div>
        {" "}
        <p className="lede" data-reveal="">
          They live in RiskGuard's code, so a clever prompt can't switch them off.
        </p>
      </div>
      {" "}
      <div data-reveal="">
        <div className="rcar" id="rcar" tabIndex={0} role="region" aria-roledescription="carousel" aria-label="RiskGuard rules" />
        {" "}
        <div className="rctl">
          <button className="rbtn" type="button" id="rPrev" aria-label="Previous rule">
            ←
          </button>
          {" "}
          <div className="rprog" aria-hidden="true">
            <b id="rProg" />
          </div>
          {" "}
          <span className="mono" id="ruleNum" aria-live="polite" />
          {" "}
          <button className="rbtn" type="button" id="rNext" aria-label="Next rule">
            →
          </button>
        </div>
      </div>
    </section>
  )
}
