// Normalisasi tahan evasi: homoglyph, karakter lebar-nol, aksen, leet, huruf berulang, dan karakter sisipan.

const ZERO_WIDTH = /[\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g

// Huruf Cyrillic/Yunani yang tampak seperti Latin.
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's',
  ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w', ɡ: 'g',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', η: 'n',
}

/** Pandangan dasar: NFKC, tanpa karakter tak terlihat, homoglyph dipetakan, aksen dibuang, huruf kecil. */
export function baseNormalize(input: string): string {
  const s = input.normalize('NFKC').replace(ZERO_WIDTH, '').toLowerCase()
  let out = ''
  for (const ch of s) out += HOMOGLYPHS[ch] ?? ch
  return out.normalize('NFD').replace(/\p{M}/gu, '')
}

const LEET_DIGITS: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' }
const LEET_SYMBOLS: Record<string, string> = { '@': 'a', $: 's', '!': 'i', '|': 'l' }

/**
 * Varian pembacaan leet. '1' bisa 'i' atau 'l'; simbol (@ $ ! |) bisa huruf atau tanda baca biasa
 * ("borong!" bukan "borongi"), jadi keduanya dicoba. Digit selalu dipetakan.
 */
export function leetVariants(base: string): string[] {
  const out: string[] = []
  for (const one of ['i', 'l']) {
    for (const symbols of [true, false]) {
      let s = ''
      for (const ch of base) s += ch === '1' ? one : (LEET_DIGITS[ch] ?? (symbols ? LEET_SYMBOLS[ch] : undefined) ?? ch)
      out.push(s)
    }
  }
  return out
}

/** "belli" / "beliii" / "sell" -> satu huruf per run, dipakai di teks dan pola agar sebanding. */
export function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/gu, '$1')
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

/** Gabungkan run >= 3 token satu huruf ("p a s t i" -> "pasti") supaya frasa tetap terbaca. */
export function mergeSingleLetterRuns(tokens: string[]): string[] {
  const out: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length >= 3) out.push(run.join(''))
    else out.push(...run)
    run = []
  }
  for (const t of tokens) {
    if (t.length === 1) run.push(t)
    else {
      flush()
      out.push(t)
    }
  }
  flush()
  return out
}
