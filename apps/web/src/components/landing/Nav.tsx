// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

export function Nav() {
  return (
    <>
      <header className="nav" id="nav">
        <div className="nav-in">
          <a href="/" className="logo" aria-label="NEXA home">
            <svg viewBox="0 0 64 64" role="img" aria-label="NEXA logo">
              <use href="#nx-mark" />
            </svg>
            <span>
              NEXA
            </span>
          </a>
          {" "}
          <nav className="links" aria-label="Main">
            <a href="#proof">
              Proof
            </a>
            {" "}
            <a href="#feed">
              Daily feed
            </a>
            {" "}
            <a href="#how">
              How it works
            </a>
            {" "}
            <a href="#pricing">
              Pricing
            </a>
            {" "}
            <a href="#token">
              $NEXA
            </a>
          </nav>
          {" "}
          <div className="nav-r">
            <a href={X_URL} target="_blank" rel="noopener" className="btn btn-light btn-x magnet">
              {"Follow on X "}
              <span className="ar">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <use href="#nx-x" />
                </svg>
              </span>
            </a>
            {" "}
            <button className="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mnav">
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      <div className="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Menu" hidden>
        <nav>
          <a href="#proof">
            Proof
          </a>
          {" "}
          <a href="#feed">
            Daily feed
          </a>
          {" "}
          <a href="#how">
            How it works
          </a>
          {" "}
          <a href="#pricing">
            Pricing
          </a>
          {" "}
          <a href="#token">
            $NEXA
          </a>
        </nav>
        {" "}
        <a href={X_URL} target="_blank" rel="noopener" className="btn btn-org btn-x">
          {"Follow NEXA on X "}
          <span className="ar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#nx-x" />
            </svg>
          </span>
        </a>
      </div>
    </>
  )
}
