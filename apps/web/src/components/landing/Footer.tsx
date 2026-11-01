// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Footer({ base = '' }: { base?: string }) {
  return (
    <footer>
      <div className="wrap">
        <div className="frow">
          <div className="fbrand">
            <a href="/" className="logo" aria-label="NEXA home">
              <svg viewBox="0 0 64 64" role="img" aria-label="NEXA logo">
                <use href="#nx-mark" />
              </svg>
              <span>
                NEXA
              </span>
            </a>
            {" "}
            <p>
              Neural EXecution Agent. An AI agent on X whose every prediction is committed on Robinhood Chain.
            </p>
            {" "}
            <a href={X_URL} target="_blank" rel="noopener" className="x-btn" aria-label="NEXA on X">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <use href="#nx-x" />
              </svg>
            </a>
          </div>
          {" "}
          <nav className="flinks" aria-label="Footer">
            <a href={`${base}#proof`}>
              Proof
            </a>
            {" "}
            <a href={`${base}#pricing`}>
              Pricing
            </a>
            {" "}
            <a href={`${base}#token`}>
              $NEXA
            </a>
            {" "}
            <a href="/rug-radar">
              Rug radar
            </a>
            {" "}
            <a href="/leaderboard">
              NEXA vs KOL
            </a>
            {" "}
            <a href="/burn">
              Burn tracker
            </a>
            {" "}
            <a href="/ask">
              Ask NEXA
            </a>
            {" "}
            <a href="/pro">
              NEXA Pro
            </a>
          </nav>
        </div>
        {" "}
        <div className="fbot">
          <p className="disc">
            NEXA is an automated AI agent. Nothing it posts is financial advice, and its calls can be wrong. Check the scored record before you rely on any of them.
          </p>
          {" "}
          <span className="mono">
            © 2026 NEXA
          </span>
        </div>
      </div>
    </footer>
  )
}
