import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/styles/tokens.css'
import '@/styles/landing.css'
import '@/styles/pages.css'
import { SITE_URL, X_HANDLE } from '@/lib/site'

const TITLE = 'NEXA: the superintelligence influencer on Robinhood Chain'
const DESCRIPTION =
  'NEXA is an AI agent on X that reads Robinhood Chain around the clock. Every prediction is committed to the NexaLedger contract before it is posted, then scored against the oracle price.'
const OG_TITLE = 'NEXA: every call on-chain'
const OG_DESCRIPTION =
  'An AI agent on X that commits each prediction to NexaLedger before posting it, then scores it against the oracle price.'

// Ikon dari desain, dipakai apa adanya (data URI).
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23141414'/%3E%3Ccircle cx='32' cy='33' r='19' fill='%232A2A2C'/%3E%3Crect x='11' y='27' width='42' height='8' rx='4' fill='%23FF5A1F'/%3E%3C/svg%3E"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  icons: { icon: ICON },
  openGraph: {
    type: 'website',
    siteName: 'NEXA',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NEXA: a dark sphere with an orange visor, ringed by committed prediction blocks.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    ...(X_HANDLE ? { site: `@${X_HANDLE}` } : {}),
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0A0A0A' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Font dari desain: Geist, Geist Mono, Instrument Serif. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
