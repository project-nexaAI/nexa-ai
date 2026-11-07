// Konfigurasi deploy dari desain: __SITE_URL__ (tanpa slash akhir) dan __X_HANDLE__ (tanpa @).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
/** Akun X resmi NEXA (publik); env dapat menimpanya. */
export const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE || 'NexaAgentX'
/** Handle kosong (dikosongkan secara eksplisit) membuat tautan "Follow on X" mengarah ke "#". */
export const X_URL = X_HANDLE ? `https://x.com/${X_HANDLE}` : '#'
/** Grup Telegram publik NEXA (alert dan prediksi harian); env dapat menimpanya. */
export const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/nexa_alerts'
