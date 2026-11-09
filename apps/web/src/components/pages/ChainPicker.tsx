'use client'

/**
 * ChainPicker — tab pemilih chain (Robinhood / Elysium testnet).
 * Hanya ditampilkan bila NEXT_PUBLIC_API_URL_ELYSIUM terkonfigurasi.
 * Menggunakan link navigasi biasa (?chain=) supaya halaman server bisa SSR.
 * Tidak muncul di landing; hanya di /proof dan /rug-radar.
 */

import { useSearchParams } from 'next/navigation'

export const SUPPORTED_CHAINS: { slug: string; label: string }[] = [
  { slug: 'robinhood', label: 'Robinhood Chain' },
  { slug: 'elysium-testnet', label: 'Elysium Testnet' },
]

interface ChainPickerProps {
  /** Apakah chain Elysium tersedia (NEXT_PUBLIC_API_URL_ELYSIUM di-set). */
  elysiumEnabled: boolean
}

export function ChainPicker({ elysiumEnabled }: ChainPickerProps) {
  const searchParams = useSearchParams()
  const currentChain = searchParams.get('chain') ?? 'robinhood'

  if (!elysiumEnabled) return null

  return (
    <div className="chain-picker" aria-label="Pilih chain">
      {SUPPORTED_CHAINS.map(({ slug, label }) => {
        const params = new URLSearchParams(searchParams)
        if (slug === 'robinhood') {
          params.delete('chain')
        } else {
          params.set('chain', slug)
        }
        const href = `?${params.toString()}`
        const active = currentChain === slug
        return (
          <a
            key={slug}
            href={href}
            className={`chain-pill${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </a>
        )
      })}
    </div>
  )
}
