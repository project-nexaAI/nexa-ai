import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Hex } from 'viem'

function toKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex.replace(/^0x/, ''), 'hex')
  if (key.length !== 32) throw new Error('PREIMAGE_KEY harus 32 byte (64 karakter hex)')
  return key
}

/** AES-256-GCM. Format: base64(iv[12] | tag[16] | ciphertext). Preimage (termasuk salt) hanya disimpan terenkripsi. */
export function encryptJson(keyHex: string, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', toKey(keyHex), iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

export function decryptJson<T>(keyHex: string, blob: string): T {
  const raw = Buffer.from(blob, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', toKey(keyHex), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  const pt = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
  return JSON.parse(pt.toString('utf8')) as T
}

export function randomSalt(): Hex {
  return `0x${randomBytes(32).toString('hex')}`
}
