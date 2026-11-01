import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import {
  signalsWhalesResponseSchema,
  alertEventSchema,
  proPlanResponseSchema,
  proSubscribeRequestSchema,
  proSubscribeResponseSchema,
  telegramLinkResponseSchema,
  askRequestSchema,
  askResponseSchema,
  meResponseSchema,
  nonceResponseSchema,
  sessionResponseSchema,
  verifyRequestSchema,
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
      '/auth/nonce': {
        get: { summary: 'Login wallet (SIWE): nonce sekali pakai. Mati sampai PAID_FEATURES_ENABLED=true.', responses: { '200': { description: 'Nonce', content: { 'application/json': { schema: schema(nonceResponseSchema) } } }, '503': err('fitur belum aktif') } },
      },
      '/auth/verify': {
        post: {
          summary: 'Verifikasi pesan SIWE + tanda tangan, lalu buat sesi bearer.',
          requestBody: { required: true, content: { 'application/json': { schema: schema(verifyRequestSchema) } } },
          responses: {
            '200': { description: 'Sesi', content: { 'application/json': { schema: schema(sessionResponseSchema) } } },
            '400': err('body tidak valid'),
            '401': err('invalid_message, domain_mismatch, bad_signature, bad_nonce, expired_message'),
            '503': err('fitur belum aktif'),
          },
        },
      },
      '/auth/logout': {
        post: { summary: 'Akhiri sesi (header Authorization: Bearer).', responses: { '204': { description: 'Selesai' }, '503': err('fitur belum aktif') } },
      },
      '/me': {
        get: {
          summary: 'Profil sesi: status holder $NEXA dan benefit (alert lebih cepat, kredit Ask gratis).',
          parameters: [{ name: 'authorization', in: 'header', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Profil', content: { 'application/json': { schema: schema(meResponseSchema) } } }, '401': err('login_required'), '503': err('fitur belum aktif') },
        },
      },
      '/pro/plan': {
        get: {
          summary: 'NEXA Pro: harga, lama periode, penerima USDG, dan chain. Mati sampai PAID_FEATURES_ENABLED=true.',
          responses: { '200': ok('Rencana Pro', proPlanResponseSchema), '503': err('fitur berbayar belum aktif') },
        },
      },
      '/pro/subscribe': {
        post: {
          summary: 'Aktifkan atau perpanjang NEXA Pro dengan tx pembayaran USDG yang sudah terkonfirmasi. Pengirim tx harus sama dengan alamat sesi; membayar kelipatan harga memberi kelipatan periode.',
          parameters: [{ name: 'authorization', in: 'header', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: schema(proSubscribeRequestSchema) } } },
          responses: {
            '200': { description: 'Langganan aktif', content: { 'application/json': { schema: schema(proSubscribeResponseSchema) } } },
            '400': err('body tidak valid'),
            '401': err('login_required'),
            '402': err('pembayaran tidak sah: tx_not_found, tx_failed, no_payment, underpaid'),
            '403': err('payer_mismatch'),
            '409': err('payment_already_used'),
            '503': err('fitur berbayar belum aktif'),
          },
        },
      },
      '/pro/telegram/link': {
        post: {
          summary: 'Kode sekali pakai (10 menit) untuk menautkan chat Telegram pribadi: kirim `/start <kode>` ke bot. Hanya pelanggan aktif.',
          parameters: [{ name: 'authorization', in: 'header', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Kode tautan', content: { 'application/json': { schema: schema(telegramLinkResponseSchema) } } },
            '401': err('login_required'),
            '402': err('subscription_required'),
            '503': err('paid_features_disabled atau telegram_not_configured'),
          },
        },
      },
      '/pro/telegram/unlink': {
        post: {
          summary: 'Putuskan chat Telegram dari alamat sesi.',
          parameters: [{ name: 'authorization', in: 'header', required: true, schema: { type: 'string' } }],
          responses: { '204': { description: 'Selesai' }, '401': err('login_required'), '503': err('fitur berbayar belum aktif') },
        },
      },
      '/alerts/stream': {
        get: {
          summary:
            'Alert Pro real-time (Server-Sent Events). Alert terkirim saat post disetujui, 15 menit sebelum post publik di X. Event `alert` berisi JSON AlertEvent. Tanpa Last-Event-ID stream dimulai dari alert terbaru; dengan itu melanjutkan dari id tersebut. Butuh langganan aktif.',
          parameters: [
            { name: 'authorization', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'last-event-id', in: 'header', required: false, schema: { type: 'integer', minimum: 0 } },
          ],
          responses: {
            '200': { description: 'text/event-stream; setiap event `alert` membawa AlertEvent', content: { 'text/event-stream': { schema: schema(alertEventSchema) } } },
            '401': err('login_required'),
            '402': err('subscription_required'),
            '503': err('fitur berbayar belum aktif'),
          },
        },
      },
      '/ask': {
        post: {
          summary: 'Ask NEXA ($1 USDG, atau kredit gratis bulanan holder $NEXA dengan sesi login tanpa txHash): ringkasan risiko satu token dari data indexer. Pembayaran diverifikasi on-chain; mati sampai PAID_FEATURES_ENABLED=true.',
          requestBody: { required: true, content: { 'application/json': { schema: schema(askRequestSchema) } } },
          responses: {
            '200': { description: 'Laporan risiko', content: { 'application/json': { schema: schema(askResponseSchema) } } },
            '400': err('body tidak valid'),
            '401': err('login_required (tanpa txHash dan tanpa sesi)'),
            '402': err('pembayaran tidak sah: tx_not_found, tx_failed, no_payment, underpaid, no_free_credits'),
            '403': err('not_a_holder'),
            '409': err('pembayaran sudah dipakai'),
            '422': err('token_too_new (< 1 jam) atau no_data; pembayaran tidak dihabiskan'),
            '503': err('fitur berbayar belum aktif'),
          },
        },
      },
      '/signals/whales': {
        get: {
          summary: 'Signals API (berbayar): transfer Stock Token besar yang tercatat indexer, terbaru dulu. Butuh header x-api-key; mati sampai PAID_FEATURES_ENABLED=true.',
          parameters: [
            { name: 'x-api-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            '200': { description: 'Transfer whale', content: { 'application/json': { schema: schema(signalsWhalesResponseSchema) } } },
            '400': err('limit tidak valid'),
            '401': err('kunci API tidak ada atau tidak valid'),
            '429': err('batas laju terlampaui (header Retry-After)'),
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
