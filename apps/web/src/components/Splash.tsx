'use client'

import { useEffect, useState } from 'react'

const KEY = 'nexa_splash'

/**
 * Loader pembuka, sekali per sesi tab. Keluarnya diatur CSS (`splash.css`), jadi komponen ini hanya mencatat bahwa sesi sudah
 * melihatnya dan melepas elemen setelah animasi keluar selesai (atau saat diklik). Konten situs dimuat di belakangnya,
 * jadi loader tidak menambah waktu tunggu.
 */
export function Splash() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (document.documentElement.dataset.splash === 'skip') return setDone(true)
    try {
      window.sessionStorage.setItem(KEY, '1')
    } catch {
      /* penyimpanan diblokir: loader tampil sekali per muat halaman */
    }
    // Pengaman: elemen dilepas walau animationend tidak terkirim (tab di latar, dll.).
    const t = window.setTimeout(() => setDone(true), 3500)
    return () => window.clearTimeout(t)
  }, [])

  if (done) return null
  return (
    <div
      className="nx-splash"
      aria-hidden="true"
      onClick={() => setDone(true)}
      onAnimationEnd={(e) => e.animationName === 'nx-exit' && setDone(true)}
    >
      <div className="nx-stage">
        <div className="nx-ring" />
        <div className="nx-mark">
          <div className="nx-halo">
            <div className="nx-glow" />
          </div>
        </div>
      </div>
    </div>
  )
}
