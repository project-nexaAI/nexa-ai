import { WalletButton } from '@/components/wallet/WalletButton'
import { X_URL } from '@/lib/site'

/** Halaman dashboard (rute) dan bagian landing (jangkar). `base` = "/" di halaman dalam supaya jangkar menuju landing. */
const PAGES = [
  { href: '/proof', label: 'Proof' },
  { href: '/rug-radar', label: 'Rug radar' },
  { href: '/leaderboard', label: 'NEXA vs KOL' },
  { href: '/burn', label: 'Burn tracker' },
  { href: '/ask', label: 'Ask NEXA' },
] as const
const SECTIONS = [
  { hash: '#how', label: 'How it works' },
  { hash: '#pricing', label: 'Pricing' },
  { hash: '#token', label: '$NEXA' },
] as const

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
            {PAGES.map((p) => (
              <a key={p.href} href={p.href}>
                {p.label}
              </a>
            ))}
            {SECTIONS.map((s) => (
              <a key={s.hash} href={`${base}${s.hash}`}>
                {s.label}
              </a>
            ))}
          </nav>
          <div className="nav-r">
            <a href={X_URL} target="_blank" rel="noopener" className="x-btn nav-x" aria-label="NEXA on X">
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
      <div className="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Menu" hidden>
        <nav>
          {PAGES.map((p) => (
            <a key={p.href} href={p.href}>
              {p.label}
            </a>
          ))}
          {SECTIONS.map((s) => (
            <a key={s.hash} href={`${base}${s.hash}`}>
              {s.label}
            </a>
          ))}
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
