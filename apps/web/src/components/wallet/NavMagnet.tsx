'use client'

import { useEffect } from 'react'

/**
 * Efek magnet tombol navbar (ikon X, Connect wallet): sama dengan tombol "Follow on X" di hero, yang digerakkan
 * `landing-motion.ts` hanya di landing. Di sini berlaku di semua halaman lewat atribut data-magnet; hanya untuk pointer halus
 * dan dimatikan bila pengguna memilih reduced motion.
 */
export function NavMagnet() {
  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return
    const cleanups: (() => void)[] = []
    document.querySelectorAll<HTMLElement>('.nav [data-magnet]').forEach((b) => {
      const move = (e: PointerEvent) => {
        const r = b.getBoundingClientRect()
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px,${(e.clientY - r.top - r.height / 2) * 0.32}px)`
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const leave = () => {
        b.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)'
        b.style.transform = ''
        timer = setTimeout(() => (b.style.transition = ''), 600)
      }
      b.addEventListener('pointermove', move)
      b.addEventListener('pointerleave', leave)
      cleanups.push(() => {
        b.removeEventListener('pointermove', move)
        b.removeEventListener('pointerleave', leave)
        if (timer) clearTimeout(timer)
        b.style.transform = ''
      })
    })
    return () => cleanups.forEach((c) => c())
  }, [])
  return null
}
