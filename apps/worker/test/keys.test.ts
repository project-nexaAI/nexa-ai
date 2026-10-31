import { describe, expect, it } from 'vitest'
import { optionalEncKey, optionalPrivateKey, normalizeEncKey, normalizePrivateKey } from '../src/keys'

const HEX = 'ab'.repeat(32)

describe('normalisasi kunci', () => {
  it('private key: terima dengan/tanpa 0x, spasi, kutip, baris baru; hasil selalu 0x + 64 hex', () => {
    for (const v of [HEX, `0x${HEX}`, `0X${HEX}`, ` ${HEX}\n`, `"0x${HEX}"`, `'${HEX}'`]) expect(normalizePrivateKey(v)).toBe(`0x${HEX}`)
  })
  it('kunci enkripsi: tanpa 0x', () => {
    expect(normalizeEncKey(` 0x${HEX} `)).toBe(HEX)
    expect(normalizeEncKey(HEX)).toBe(HEX)
  })
  it('skema: kosong = tidak diisi; bentuk salah ditolak tanpa membocorkan nilainya', () => {
    expect(optionalPrivateKey.parse('')).toBe('')
    expect(optionalPrivateKey.parse(undefined)).toBeUndefined()
    expect(optionalPrivateKey.parse(HEX)).toBe(`0x${HEX}`)
    const secret = 'rahasia-yang-salah-123'
    const r = optionalPrivateKey.safeParse(secret)
    expect(r.success).toBe(false)
    if (!r.success) expect(JSON.stringify(r.error.issues)).not.toContain(secret)
    expect(optionalEncKey.safeParse('xyz').success).toBe(false)
    expect(optionalEncKey.parse(`0x${HEX}`)).toBe(HEX)
  })
})
