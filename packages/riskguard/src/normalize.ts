// Normalisasi tahan evasi: homoglyph, karakter tak terlihat, aksen, leet, huruf berulang, dan karakter sisipan.
// Catatan: file ini sengaja tanpa escape \u; karakter tak terlihat dibuang lewat \p{Cf} dan daftar code point.

/** Karakter yang tampak kosong tetapi bukan kategori Cf. */
const BLANK_CODEPOINTS = new Set([0x3164, 0x115f, 0x1160, 0x2800, 0x180e, 0x17b4, 0x17b5, 0x034f, 0xffa0])
const FORMAT_RE = /[\p{Cf}\p{Zl}\p{Zp}]/gu
const IDEOGRAPHIC_FULL_STOP = 0x3002

// Huruf non-Latin/small caps/bergaris yang tampak seperti Latin.
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's',
  ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w', ɡ: 'g',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', η: 'n',
  ո: 'n', ս: 'u', օ: 'o',
  ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o',
  ᴘ: 'p', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z', ᴀ: 'a',
  ı: 'i', ł: 'l', đ: 'd', ø: 'o', ð: 'd', þ: 'p',
}

/** Buang karakter format/kosong (dipakai juga untuk memeriksa label "Sponsored"). */
export function stripInvisible(input: string): string {
  const s = input.normalize('NFKC').replace(FORMAT_RE, '')
  let out = ''
  for (const ch of s) if (!BLANK_CODEPOINTS.has(ch.codePointAt(0)!)) out += ch
  return out
}

/** Pandangan dasar: NFKC, tanpa karakter tak terlihat, homoglyph dipetakan, aksen dibuang, huruf kecil. */
export function baseNormalize(input: string): string {
  const s = stripInvisible(input).toLowerCase()
  let out = ''
  for (const ch of s) out += ch.codePointAt(0) === IDEOGRAPHIC_FULL_STOP ? '.' : (HOMOGLYPHS[ch] ?? ch)
  return out.normalize('NFD').replace(/\p{M}/gu, '')
}

const LEET_DIGITS: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' }
const LEET_SYMBOLS: Record<string, string> = { '@': 'a', $: 's', '!': 'i', '|': 'l' }

/**
 * Varian pembacaan leet. '1' bisa 'i' atau 'l'; simbol (@ $ ! |) bisa huruf atau tanda baca biasa
 * ("borong!" bukan "borongi"), jadi keduanya dicoba. Token angka murni ("531", "411") tidak di-leet
 * supaya data numerik tidak terbaca sebagai kata.
 */
export function leetVariants(base: string): string[] {
  const tokens = base.split(/\s+/)
  const out: string[] = []
  for (const one of ['i', 'l']) {
    for (const symbols of [true, false]) {
      out.push(
        tokens
          .map((tok) => {
            if (!/[a-z]/.test(tok)) return tok
            let s = ''
            for (const ch of tok) s += ch === '1' ? one : (LEET_DIGITS[ch] ?? (symbols ? LEET_SYMBOLS[ch] : undefined) ?? ch)
            return s
          })
          .join(' '),
      )
    }
  }
  return out
}

/** "belli" / "beliii" / "sell" -> satu huruf per run, dipakai di teks dan pola agar sebanding. */
export function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/gu, '$1')
}

/** Kolaps huruf berulang hanya pada kata di dalam sumber regex (tanda baca regex tidak disentuh). */
export function collapsePattern(src: string): string {
  return src.replace(/[a-z]+/g, collapseRepeats)
}

/**
 * Token alfabet bersih per potongan berspasi: "b.e.l.i" -> "beli", "j*u*a*l" -> "jual".
 * Potongan tanpa huruf dibuang.
 */
export function cleanTokens(leeted: string): string[] {
  return leeted
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter((t) => t.length > 0)
}

/** Token huruf dengan pemisah apa pun ("pasti/naik", "all-in", "ape_in" -> kata terpisah). */
export function letterTokens(leeted: string): string[] {
  return leeted.split(/[^a-z]+/).filter((t) => t.length > 0)
}

/** Gabungkan run >= 2 token pendek (<= 3 huruf): "pa sti" -> "pasti", "p a s t i" -> "pasti". */
export function mergeShortRuns(tokens: string[]): string[] {
  const out: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length >= 2) out.push(run.join(''))
    else out.push(...run)
    run = []
  }
  for (const t of tokens) {
    if (t.length <= 3) run.push(t)
    else {
      flush()
      out.push(t)
    }
  }
  flush()
  return out
}
