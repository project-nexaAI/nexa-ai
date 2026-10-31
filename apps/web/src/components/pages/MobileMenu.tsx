'use client'

import { useEffect } from 'react'

/** Menu mobile untuk halaman dalam (di landing, ini ditangani skrip gerak desain). */
export function MobileMenu() {
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>('.menu-btn')
    const menu = document.getElementById('mnav')
    if (!btn || !menu) return
    const set = (open: boolean) => {
      menu.hidden = !open
      btn.setAttribute('aria-expanded', String(open))
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
      document.documentElement.style.overflow = open ? 'hidden' : ''
    }
    const toggle = () => set(menu.hidden)
    const close = () => set(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    btn.addEventListener('click', toggle)
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close))
    document.addEventListener('keydown', onKey)
    return () => {
      btn.removeEventListener('click', toggle)
      menu.querySelectorAll('a').forEach((a) => a.removeEventListener('click', close))
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [])
  return null
}
