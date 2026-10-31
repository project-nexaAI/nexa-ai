import { createApiClient } from '@nexa-ai/api-client'

/** Klien API untuk halaman server. Fixture bila NEXT_PUBLIC_USE_FIXTURES=true; selain itu API asli. */
export const api = () =>
  createApiClient({
    useFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    proofFixture: process.env.FIXTURE_PROOF === 'populated' ? 'populated' : 'empty',
  })

/** Gagal ambil data tidak merusak halaman: hasilnya null dan halaman menampilkan keadaan "tidak tersedia". */
export async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch {
    return null
  }
}
