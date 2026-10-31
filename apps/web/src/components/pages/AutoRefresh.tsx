'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Memuat ulang data server secara berkala (rug radar real-time). Berhenti saat tab tidak terlihat. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
