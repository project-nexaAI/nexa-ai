import { NavMagnet } from '@/components/wallet/NavMagnet'
import { WalletButton } from '@/components/wallet/WalletButton'
import { X_URL } from '@/lib/site'

import { NAV_DIRECT, NAV_GROUPS, itemHref } from '@/lib/nav'

/** Menu dikelompokkan (lib/nav.ts). `base` = "/" di halaman dalam supaya jangkar menuju landing. */

export function Nav({ base = '' }: { base?: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  return (
    <>
      <header className="nav" id="nav">
        <div className="nav-in">
          <a href="/" className="logo" aria-label="NEXA home">
            <svg viewBox="0 0 64 64" role="img" aria-label="NEXA logo">
              <use href="#nx-mark" />
            </svg>
            <span>NEXA</span>
          </a>
          <nav className="links" aria-label="Main">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="dd">
                <button type="button" className="dd-btn" aria-haspopup="true">
                  {g.label}
                  <svg viewBox="0 0 10 6" aria-hidden="true">
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="dd-menu">
                  {g.items.map((i) => (
                    <a key={i.label} href={itemHref(i, base)}>
                      {i.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {NAV_DIRECT.map((i) => (
              <a key={i.label} href={itemHref(i, base)}>
                {i.label}
              </a>
            ))}
          </nav>
          <div className="nav-r">
            <a href={X_URL} target="_blank" rel="noopener" className="x-btn nav-x" aria-label="NEXA on X" data-magnet="">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <use href="#nx-x" />
              </svg>
            </a>
            <WalletButton apiUrl={apiUrl} />
            <button className="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mnav">
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      <NavMagnet />
      <div className="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Menu" hidden>
        <nav>
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mgroup">
              <span className="mono">{g.label}</span>
              {g.items.map((i) => (
                <a key={i.label} href={itemHref(i, base)}>
                  {i.label}
                </a>
              ))}
            </div>
          ))}
          <div className="mgroup">
            {NAV_DIRECT.map((i) => (
              <a key={i.label} href={itemHref(i, base)}>
                {i.label}
              </a>
            ))}
          </div>
        </nav>
        <a href={X_URL} target="_blank" rel="noopener" className="btn btn-org btn-x">
          {'Follow NEXA on X '}
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
