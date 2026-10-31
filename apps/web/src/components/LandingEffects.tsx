'use client'

import { useEffect } from 'react'
import type { NxData } from '@/lib/nx-data'

/**
 * Menjalankan skrip gerak & scene 3D dari desain sekali setelah hydrate.
 * Urutan sama dengan HTML asli: skrip gerak dulu (mendefinisikan window.__NX), lalu modul three.js.
 */
export function LandingEffects({ data }: { data: NxData }) {
  useEffect(() => {
    const w = window as unknown as { __NX_BOOTED?: boolean }
    if (w.__NX_BOOTED) return
    w.__NX_BOOTED = true
    void (async () => {
      const { initMotion } = await import('@/lib/landing-motion')
      initMotion(data)
      const { init3d } = await import('@/lib/landing-3d')
      init3d()
    })()
  }, [data])
  return null
}
