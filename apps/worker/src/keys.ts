import { z } from 'zod'

/** Buang spasi, baris baru, dan tanda kutip di ujung (kesalahan umum saat menempel nilai di dashboard). */
export const cleanSecret = (s: string): string => s.trim().replace(/^["']|["']$/g, '').trim()

/** Private key EVM 32 byte: terima dengan atau tanpa awalan 0x; hasil selalu `0x` + 64 hex. Kosong tetap kosong. */
export const normalizePrivateKey = (s: string): string => {
  const c = cleanSecret(s)
  const hex = c.replace(/^0x/i, '')
  return /^[0-9a-fA-F]{64}$/.test(hex) ? `0x${hex}` : c
}

/** Kunci enkripsi 32 byte: 64 hex, terima dengan atau tanpa 0x; hasil tanpa 0x. */
export const normalizeEncKey = (s: string): string => cleanSecret(s).replace(/^0x/i, '')

/**
 * Pesan galat TIDAK memuat nilainya (zod hanya melaporkan nama field). Kosong dianggap tidak diisi, supaya
 * variabel kosong di dashboard tidak membuat worker crash.
 */
export const optionalPrivateKey = z
  .string()
  .transform(normalizePrivateKey)
  .pipe(z.union([z.literal(''), z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'harus 64 karakter hex (boleh dengan 0x)')]))
  .optional()

export const optionalEncKey = z
  .string()
  .transform(normalizeEncKey)
  .pipe(z.union([z.literal(''), z.string().regex(/^[0-9a-fA-F]{64}$/, 'harus 64 karakter hex')]))
  .optional()
