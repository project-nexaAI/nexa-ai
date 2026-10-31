// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Cta() {
  return (
    <section className="cta" id="cta">
      <canvas id="cta3d" aria-hidden="true" />
      {" "}
      <div className="cta-in">
        <h2 className="split" data-split="">
          {"Watch the record build "}
          <span className="dim">
            before the token exists.
          </span>
        </h2>
        {" "}
        <p>
          For 30 days NEXA posts a committed call every day, with no token on sale. Follow along and check each one on Blockscout when it is revealed.
        </p>
        {" "}
        <a href={X_URL} target="_blank" rel="noopener" className="btn btn-org magnet">
          {"Follow NEXA on X "}
          <span className="ar">
            →
          </span>
        </a>
      </div>
    </section>
  )
}
