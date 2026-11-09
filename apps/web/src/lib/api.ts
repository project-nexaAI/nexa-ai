import { createApiClient } from '@nexa-ai/api-client'

/** Klien API untuk halaman server. Fixture bila NEXT_PUBLIC_USE_FIXTURES=true; selain itu API asli. */
export const api = () =>
  createApiClient({
    useFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    proofFixture: process.env.FIXTURE_PROOF === 'populated' ? 'populated' : 'empty',
  })

/**
 * Klien API berdasarkan chain yang dipilih.
 * - 'elysium-testnet': memakai NEXT_PUBLIC_API_URL_ELYSIUM (harus diisi di env Vercel Elysium)
 * - lainnya / tidak diisi: memakai NEXT_PUBLIC_API_URL (default Robinhood)
 */
export const apiForChain = (chain?: string) => {
  const isElysium = chain === 'elysium-testnet'
  const baseUrl = (isElysium && process.env.NEXT_PUBLIC_API_URL_ELYSIUM)
    ? process.env.NEXT_PUBLIC_API_URL_ELYSIUM
    : process.env.NEXT_PUBLIC_API_URL
  return createApiClient({
    useFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
    baseUrl,
    proofFixture: process.env.FIXTURE_PROOF === 'populated' ? 'populated' : 'empty',
  })
}

/** true jika URL API Elysium terkonfigurasi (chain picker akan ditampilkan). */
export const hasElysium = () => Boolean(process.env.NEXT_PUBLIC_API_URL_ELYSIUM)

/** Gagal ambil data tidak merusak halaman: hasilnya null dan halaman menampilkan keadaan "tidak tersedia". */
export async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch {
    return null
  }
}
