import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import {
  askRequestSchema,
  askResponseSchema,
  burnResponseSchema,
  leaderboardResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
  signalsResponseSchema,
} from '@nexa-ai/api-client'

const schema = (s: ZodTypeAny) => zodToJsonSchema(s, { target: 'openApi3', $refStrategy: 'none' })
const ok = (description: string, s: ZodTypeAny) => ({
  description,
  headers: { 'Cache-Control': { schema: { type: 'string' }, description: 'public, max-age=15' } },
  content: { 'application/json': { schema: schema(s) } },
})
const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] } } },
})

/** Spesifikasi OpenAPI; dibuat dari skema zod yang sama dengan yang memvalidasi response dan fixture. */
export function buildOpenApi() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'NEXA API',
      version: '0.1.0',
      description:
        'API publik NEXA. Nilai mentah dan terformat tersedia berdampingan; setiap commit menyertakan link Blockscout. Waktu dalam UTC (ISO 8601).',
    },
    paths: {
      '/healthz': { get: { summary: 'Cek hidup', responses: { '200': { description: 'OK' } } } },
      '/proof': {
        get: {
          summary: 'Proof of Intelligence: win rate, rata-rata return, Prediction of the Day berjalan, riwayat terbaru',
          responses: { '200': ok('Ringkasan rekam jejak', proofResponseSchema) },
        },
      },
      '/predictions/{id}': {
        get: {
          summary: 'Satu prediksi menurut id NexaLedger. Teks dan salt baru terlihat setelah reveal.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 0 } }],
          responses: { '200': ok('Prediksi', predictionResponseSchema), '400': err('id tidak valid'), '404': err('tidak ditemukan') },
        },
      },
      '/rug-radar': {
        get: { summary: 'Launch Pons V2 terbaru dengan red flag', responses: { '200': ok('Daftar launch', rugRadarResponseSchema) } },
      },
      '/leaderboard': {
        get: {
          summary: 'NEXA vs KOL: leaderboard akurasi. Hanya KOL yang bersedia dinilai; peringkat butuh minimal minScored call ternilai.',
          responses: { '200': ok('Peringkat akurasi', leaderboardResponseSchema) },
        },
      },
      '/burn': {
        get: { summary: 'Burn tracker $NEXA (BurnVault)', responses: { '200': ok('Total dan riwayat burn', burnResponseSchema) } },
      },
      '/ask': {
        post: {
          summary: 'Ask NEXA (berbayar, $1 USDG): ringkasan risiko satu token dari data indexer. Pembayaran diverifikasi on-chain; mati sampai PAID_FEATURES_ENABLED=true.',
          requestBody: { required: true, content: { 'application/json': { schema: schema(askRequestSchema) } } },
          responses: {
            '200': { description: 'Laporan risiko', content: { 'application/json': { schema: schema(askResponseSchema) } } },
            '400': err('body tidak valid'),
            '402': err('pembayaran tidak sah: tx_not_found, tx_failed, no_payment, underpaid'),
            '409': err('pembayaran sudah dipakai'),
            '422': err('token_too_new (< 1 jam) atau no_data; pembayaran tidak dihabiskan'),
            '503': err('fitur berbayar belum aktif'),
          },
        },
      },
      '/signals': {
        get: {
          summary: 'Signals API (berbayar): feed post publik NEXA. Butuh header x-api-key; mati sampai PAID_FEATURES_ENABLED=true.',
          parameters: [
            { name: 'x-api-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            '200': { description: 'Feed sinyal', content: { 'application/json': { schema: schema(signalsResponseSchema) } } },
            '401': err('kunci API tidak ada atau tidak valid'),
            '429': err('batas laju terlampaui (header Retry-After)'),
            '503': err('fitur berbayar belum aktif'),
          },
        },
      },
    },
  }
}
