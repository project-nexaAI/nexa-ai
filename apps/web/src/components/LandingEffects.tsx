'use client'

import { useEffect } from 'react'
import type { NxData } from '@/lib/nx-data'

/**
 * Menjalankan skrip gerak & scene 3D dari desain sekali setelah hydrate.
 * Urutan sama dengan HTML asli: skrip gerak dulu (mendefinisikan window.__NX), lalu modul three.js.
 *
 * Skrip desain memasang observer dan listener global pada DOM yang ada saat dijalankan, sehingga tidak
 * bisa dijalankan ulang. Jika pengguna kembali ke landing lewat navigasi sisi klien (tombol Back dari
 * /pro, dst.), DOM baru tidak terpasang dan seluruh elemen [data-reveal] tetap tersembunyi (halaman
 * kosong). Dalam kasus itu halaman dimuat ulang penuh.
 */
export function LandingEffects({ data }: { data: NxData }) {
  useEffect(() => {
    const w = window as unknown as { __NX_BOOTED?: boolean; __NX_LEFT_AT?: number }
    if (w.__NX_BOOTED) {
      // Remount cepat = StrictMode di dev; remount setelah meninggalkan halaman = kembali dari halaman lain.
      if (Date.now() - (w.__NX_LEFT_AT ?? 0) > 500) window.location.reload()
      return
    }
    w.__NX_BOOTED = true
    void (async () => {
      const { initMotion } = await import('@/lib/landing-motion')
      initMotion(data)
      const { init3d } = await import('@/lib/landing-3d')
      init3d()
    })()
    return () => {
      w.__NX_LEFT_AT = Date.now()
    }
  }, [data])
  return null
}
