import type { ReactNode } from 'react'
import { Footer } from '@/components/landing/Footer'
import { Nav } from '@/components/landing/Nav'
import { Sprite } from '@/components/landing/Sprite'
import { MobileMenu } from './MobileMenu'

/** Kerangka halaman dalam: nav + footer landing yang sama, tab antar-halaman, dan judul. */
export function PageShell({
  label,
  title,
  dim,
  intro,
  children,
}: {
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
