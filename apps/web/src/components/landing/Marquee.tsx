// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="mq" id="mq">
        <span>
          Stock Token movers
        </span>
        <span>
          DEX vs Chainlink spread
        </span>
        <span>
          Pons V2 graduations
        </span>
        <span>
          Red flags
        </span>
        <span>
          Prediction of the Day
        </span>
        <span>
          Contract risk checks
        </span>
      </div>
    </div>
  )
}
