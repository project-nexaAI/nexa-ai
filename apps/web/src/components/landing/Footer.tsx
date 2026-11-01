// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
import { NAV_DIRECT, NAV_GROUPS, itemHref } from '@/lib/nav'
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
          <nav className="fcols" aria-label="Footer">
            {[...NAV_GROUPS, { label: 'NEXA', items: [...NAV_DIRECT, { label: 'Follow on X', href: X_URL }] }].map((g) => (
              <div key={g.label} className="fcol">
                <span className="mono">{g.label}</span>
                {g.items.map((i) => (
                  <a key={i.label} href={itemHref(i, base)} {...(i.href === X_URL ? { target: '_blank', rel: 'noopener' } : {})}>
                    {i.label}
                  </a>
                ))}
              </div>
            ))}
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
