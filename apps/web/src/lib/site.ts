// Konfigurasi deploy dari desain: __SITE_URL__ (tanpa slash akhir) dan __X_HANDLE__ (tanpa @).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE ?? ''
/** Tanpa handle (belum diberikan), tautan "Follow on X" mengarah ke "#" dan tidak menebak akun. */
export const X_URL = X_HANDLE ? `https://x.com/${X_HANDLE}` : '#'
