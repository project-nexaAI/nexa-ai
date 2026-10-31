import { createApiClient, type ProofResponse } from '@nexa-ai/api-client'

/** Data dari API yang dibutuhkan skrip gerak. Semua opsional: tanpa data, desain tampil seperti aslinya. */
export interface NxData {
  /** Commit terbaru untuk kartu "Example commit"; null = contoh ilustrasi dari desain. */
  latest: { hash: string; committedAt: string; maturesAt: string } | null
  /** Hari ke-N dari 7 pada Prediction of the Day yang berjalan; null = contoh dari desain (hari 4). */
  currentDay: number | null
  horizonDays: number
  /** Win rate 0..1 untuk gauge; null = belum ada panggilan yang dinilai. */
  winRate: number | null
  winRateText: string | null
  avgReturnText: string | null
  scored: number
}

export const EMPTY_NX_DATA: NxData = {
  latest: null,
  currentDay: null,
  horizonDays: 7,
  winRate: null,
  winRateText: null,
  avgReturnText: null,
  scored: 0,
}

export function toNxData(proof: ProofResponse): NxData {
  const p = proof.current?.prediction
  return {
    latest: p ? { hash: p.hash, committedAt: p.committedAt, maturesAt: p.maturesAt } : null,
    currentDay: proof.current?.day ?? null,
    horizonDays: p?.horizonDays ?? 7,
    winRate: proof.stats.winRate,
    winRateText: proof.formatted.winRate,
    avgReturnText: proof.formatted.avgReturn,
    scored: proof.stats.scored,
  }
}

/** Fixture bila NEXT_PUBLIC_USE_FIXTURES=true, selain itu API asli. Gagal ambil data tidak merusak halaman. */
export async function loadNxData(): Promise<NxData> {
  const client = createApiClient({
    useFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    proofFixture: process.env.FIXTURE_PROOF === 'populated' ? 'populated' : 'empty',
  })
  try {
    return toNxData(await client.getProof())
  } catch {
    return EMPTY_NX_DATA
  }
}
