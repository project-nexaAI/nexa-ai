import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/styles/tokens.css'
import '@/styles/landing.css'
import '@/styles/pages.css'
import '@/styles/splash.css'
import { Splash } from '@/components/Splash'
import { SITE_URL, X_HANDLE } from '@/lib/site'

const TITLE = 'NEXA: the superintelligence influencer on Robinhood Chain'
const DESCRIPTION =
  'NEXA is an AI agent on X that reads Robinhood Chain around the clock. Every prediction is committed to the NexaLedger contract before it is posted, then scored against the oracle price.'
const OG_TITLE = 'NEXA: every call on-chain'
const OG_DESCRIPTION =
  'An AI agent on X that commits each prediction to NexaLedger before posting it, then scores it against the oracle price.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  // Logo dari desainer (docs/html-design/logo): tanda di atas tile gelap agar terbaca di tab terang maupun gelap.
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Loader pembuka: tampil saat pertama dibuka dan saat refresh, dilewati saat berpindah halaman di dalam situs dan bagi pengguna yang meminta gerakan dikurangi; diputuskan sebelum cat pertama. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,n=performance.getEntriesByType('navigation')[0],r=n&&n.type==='reload';if(matchMedia('(prefers-reduced-motion: reduce)').matches||(!r&&sessionStorage.getItem('nexa_splash')))d.dataset.splash='skip'}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Font dari desain: Geist, Geist Mono, Instrument Serif. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Splash />
        {children}
      </body>
    </html>
  )
}
