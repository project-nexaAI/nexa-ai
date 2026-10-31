// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { X_URL } from '@/lib/site'

/** `base` = "/" di halaman dalam supaya tautan jangkar menuju landing. */
export function Nav({ base = '' }: { base?: string }) {
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
            <a href={`${base}#proof`}>
              Proof
            </a>
            {" "}
            <a href={`${base}#feed`}>
              Daily feed
            </a>
            {" "}
            <a href={`${base}#how`}>
              How it works
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
            <a href={`${base}#explore`}>
              Dashboards
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
          <a href={`${base}#proof`}>
            Proof
          </a>
          {" "}
          <a href={`${base}#feed`}>
            Daily feed
          </a>
          {" "}
          <a href={`${base}#how`}>
            How it works
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
          <a href={`${base}#explore`}>
            Dashboards
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
