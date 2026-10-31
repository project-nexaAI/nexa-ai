import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import {
  burnResponseSchema,
  predictionResponseSchema,
  proofResponseSchema,
  rugRadarResponseSchema,
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
      '/burn': {
        get: { summary: 'Burn tracker $NEXA (BurnVault)', responses: { '200': ok('Total dan riwayat burn', burnResponseSchema) } },
      },
    },
  }
}
