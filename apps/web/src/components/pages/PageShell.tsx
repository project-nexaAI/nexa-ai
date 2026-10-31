import type { ReactNode } from 'react'
import { Footer } from '@/components/landing/Footer'
import { Nav } from '@/components/landing/Nav'
import { Sprite } from '@/components/landing/Sprite'
import { MobileMenu } from './MobileMenu'

export const PAGES = [
  { href: '/proof', label: 'Proof' },
  { href: '/rug-radar', label: 'Rug radar' },
  { href: '/leaderboard', label: 'NEXA vs KOL' },
  { href: '/burn', label: 'Burn tracker' },
  { href: '/ask', label: 'Ask NEXA' },
] as const

/** Kerangka halaman dalam: nav + footer landing yang sama, tab antar-halaman, dan judul. */
export function PageShell({
  current,
  label,
  title,
  dim,
  intro,
  children,
}: {
  current: (typeof PAGES)[number]['href'] | null
  label: string
  title: string
  dim?: string
  intro?: string
  children: ReactNode
}) {
  return (
    <>
      <Sprite />
      <Nav base="/" />
      <main className="wrap pg">
        <div className="pg-head">
          <div className="label">{label}</div>
          <h1>
            {title}
            {dim ? (
              <>
                <br />
                <span className="dim">{dim}</span>
              </>
            ) : null}
          </h1>
          {intro ? <p>{intro}</p> : null}
        </div>
        <nav className="pg-tabs" aria-label="Dashboards">
          {PAGES.map((p) => (
            <a key={p.href} href={p.href} aria-current={p.href === current ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        {children}
      </main>
      <Footer base="/" />
      <MobileMenu />
    </>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pg-empty">
      <b>{title}</b>
      {children}
    </div>
  )
}
