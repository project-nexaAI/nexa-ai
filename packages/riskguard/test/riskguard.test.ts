import { describe, expect, it } from 'vitest'
import { evaluate, toLogEntry, type ContentType, type ReasonCode, type RiskGuardInput } from '../src'

const ADDR = '0x1111111111111111111111111111111111111111'
const NFA_ID = 'Bukan nasihat keuangan.'
const NFA_EN = 'Not financial advice.'

function run(text: string, over: Partial<RiskGuardInput> = {}) {
  return evaluate({ type: 'daily_summary', text, dataComplete: true, ...over })
}
const blocked = (text: string, code: ReasonCode, over: Partial<RiskGuardInput> = {}) => {
  const d = run(text, over)
  expect(d.allowed, `harus diblokir: "${text}"`).toBe(false)
  expect(d.reasons).toContain(code)
}
const passes = (text: string, over: Partial<RiskGuardInput> = {}) => {
  const d = run(text, over)
  expect(d.reasons, `harus lolos: "${text}"`).toEqual([])
  expect(d.allowed).toBe(true)
}

describe('ajakan beli/jual', () => {
  it.each([
    'Sekarang waktunya beli NVDA',
    'Jual sebelum terlambat',
    'Saya membeli lebih banyak',
    'Ayo borong!',
    'You should buy this dip',
    'Time to sell everything',
    'Whales are selling',
    'Pasti naik minggu ini',
    'Dijamin cuan',
    'This is guaranteed',
    'Going all in',
    'To the moon',
  ])('blokir: %s', (t) => blocked(t, 'ADVICE_PHRASE'))

  it.each([
    'b e l i sekarang',
    'b.e.l.i sekarang',
    'j*u*a*l semua',
    'B3LI sekarang',
    'bUy now',
    'ｂｕｙ now', // fullwidth
    'bеli sekarang', // 'е' Cyrillic
    'buуу now', // y Cyrillic + berulang
    'beliiii sekarang',
    'b\u200Be\u200Bl\u200Bi sekarang', // zero-width
    'be li sekarang',
    's e l l it',
    's3ll it',
    'pasti   naik',
    'p a s t i naik',
  ])('blokir evasi: %j', (t) => blocked(t, 'ADVICE_PHRASE'))

  it.each([
    'Volume NVDA di DEX naik 12% dibanding kemarin.',
    'Beliau menyebut data ini belum final.',
    'I believe the data shows a transfer of 1.2M tokens.',
    'The seller field in the log is empty.',
    'Selisih harga DEX vs oracle: 0.8%.',
    'Dompet besar memindahkan 1,2 juta token ke bursa.',
  ])('lolos: %s', (t) => passes(t))
})

describe('target harga', () => {
  it.each([
    'Target harga $200',
    'Price target 250 dalam 7 hari',
    'TP 120',
    'NVDA akan mencapai $200',
    'ETH to $5000',
    'Take profit di area atas',
    'Pasang stop loss ketat',
  ])('blokir: %s', (t) => blocked(t, 'PRICE_TARGET'))

  it('lolos: pernyataan arah tanpa angka target', () => passes('NVDA diprediksi ditutup lebih tinggi dalam 7 hari.'))
})

describe('$NEXA', () => {
  it.each(['Kabar baik soal $NEXA', 'Token NEXA makin ramai', 'NEXA token bergerak', '$ n e x a', '$N3XA'])(
    'blokir di post biasa: %s',
    (t) => blocked(t, 'NEXA_MENTION'),
  )

  it('lolos: NEXA sebagai nama agent', () => passes('NEXA membaca 3 launch Pons hari ini.'))

  it.each<ContentType>(['technical_announcement', 'burn_report'])('boleh disebut di %s', (type) => {
    const d = evaluate({ type, text: 'Burn #12: 1.000 $NEXA dibakar. Tx tercatat on-chain.', dataComplete: true })
    expect(d.reasons).toEqual([])
  })

  it.each<ContentType>(['technical_announcement', 'burn_report'])('harga $NEXA tetap diblokir di %s', (type) => {
    const d = evaluate({ type, text: '$NEXA harga naik setelah burn', dataComplete: true })
    expect(d.allowed).toBe(false)
    expect(d.reasons).toContain('NEXA_PRICE')
  })

  it('ajakan beli $NEXA diblokir di burn_report', () => {
    const d = evaluate({ type: 'burn_report', text: 'Beli $NEXA sebelum burn berikutnya', dataComplete: true })
    expect(d.reasons).toContain('ADVICE_PHRASE')
  })
})

describe('sponsored', () => {
  const sp = (text: string) => evaluate({ type: 'sponsored', text, dataComplete: true })
  it('lolos dengan label', () => expect(sp('Sponsored: riset independen soal likuiditas Pons.').reasons).toEqual([]))
  it.each(['Riset independen soal likuiditas.', 'sponsored: riset', 'Hasil riset (Sponsored)'])('tanpa label diblokir: %s', (t) =>
    expect(sp(t).reasons).toContain('SPONSORED_LABEL'),
  )
  it('rekomendasi beli di konten sponsor diblokir', () => expect(sp('Sponsored: beli token ini').reasons).toContain('ADVICE_PHRASE'))
  it('selalu butuh persetujuan', () => expect(sp('Sponsored: riset').requiresApproval).toBe(true))
})

describe('umur token & alamat', () => {
  const tok = (ageSeconds: number | null) => ({ tokens: [{ address: ADDR, ageSeconds }] })
  it('blokir token < 1 jam', () => blocked(`Analisis ${ADDR}`, 'TOKEN_TOO_NEW', tok(3599)))
  it('lolos tepat 1 jam', () => passes(`Analisis ${ADDR}`, tok(3600)))
  it('blokir umur tidak diketahui', () => blocked(`Analisis ${ADDR}`, 'TOKEN_AGE_UNKNOWN', tok(null)))
  it('blokir alamat yang tidak ada di tool result', () => blocked(`Analisis ${ADDR}`, 'UNTRACKED_ADDRESS'))
  it('alamat berbeda huruf besar tetap dikenali', () =>
    passes(`Analisis ${ADDR.toUpperCase().replace('0X', '0x')}`, tok(7200)))
  it('batas umur bisa dikonfigurasi', () => {
    const d = evaluate({ type: 'daily_summary', text: 'x', dataComplete: true, tokens: [{ address: ADDR, ageSeconds: 7200 }] }, { minTokenAgeSeconds: 86_400 })
    expect(d.reasons).toContain('TOKEN_TOO_NEW')
  })
})

describe('data tidak lengkap', () => {
  it('blokir klaim jika data tidak lengkap', () => blocked('NVDA naik 3% di DEX.', 'DATA_INCOMPLETE', { dataComplete: false }))
  it('default tanpa bukti data = tidak lengkap', () => {
    expect(evaluate({ type: 'daily_summary', text: 'NVDA naik 3%.' }).reasons).toContain('DATA_INCOMPLETE')
  })
  it.each(['Maaf, saya tidak tahu: data belum tersedia.', 'NEXA belum punya data untuk kontrak ini.', "I don't know yet, not enough data."])(
    'jawaban "tidak tahu" lolos: %s',
    (t) => {
      const d = evaluate({ type: 'mention_reply', text: t, dataComplete: false })
      expect(d.reasons).toEqual([])
    },
  )
  it('"tidak tahu" yang menyelipkan klaim/ajakan tetap diblokir', () => {
    const d = evaluate({ type: 'mention_reply', text: 'Saya tidak tahu, tapi beli saja', dataComplete: false })
    expect(d.reasons).toContain('ADVICE_PHRASE')
  })
})

describe('tanpa link', () => {
  it.each([
    'Lihat https://nexa.example.com',
    'cek www.example.org',
    'detail di nexa.xyz',
    't.me/nexa',
    'nexa[.]ai',
    'nexa (dot) ai',
    'nexa dot com',
    'hxxps://evil.test',
  ])('blokir: %s', (t) => blocked(t, 'URL'))

  it.each(['Rasio 1.5 dan 0.8% selisih.', 'Versi 2.0 rilis. Sesuai data tool.'])('lolos: %s', (t) => passes(t))
})

describe('disclaimer', () => {
  const pred = (text: string) => evaluate({ type: 'prediction', text, dataComplete: true })
  it('prediksi tanpa disclaimer diblokir', () => expect(pred('NVDA diprediksi lebih tinggi dalam 7 hari.').reasons).toContain('MISSING_DISCLAIMER'))
  it.each([NFA_ID, NFA_EN, 'NFA.'])('prediksi dengan disclaimer lolos: %s', (d) =>
    expect(pred(`NVDA diprediksi lebih tinggi dalam 7 hari. ${d}`).reasons).toEqual([]),
  )
  it('ringkasan harian tidak mewajibkan disclaimer', () => passes('Selisih DEX vs oracle NVDA 0.4%.'))
  it('risk_report dan mention_reply mewajibkan disclaimer', () => {
    for (const type of ['risk_report', 'mention_reply'] as const) {
      expect(evaluate({ type, text: 'Kontrak punya creator tax 5%.', dataComplete: true }).reasons).toContain('MISSING_DISCLAIMER')
    }
  })
})

describe('persetujuan manusia', () => {
  it('mode all: semua post butuh persetujuan', () => expect(run('Selisih DEX vs oracle 0.4%.').requiresApproval).toBe(true))
  it('mode risky: ringkasan aman tidak butuh persetujuan', () => {
    const d = evaluate({ type: 'daily_summary', text: 'Selisih DEX vs oracle 0.4%.', dataComplete: true }, { approvalMode: 'risky' })
    expect(d).toEqual({ allowed: true, reasons: [], requiresApproval: false })
  })
  it.each<ContentType>(['mention_reply', 'risk_report', 'sponsored'])('mode risky: %s tetap butuh persetujuan', (type) => {
    const d = evaluate({ type, text: `Sponsored: x. ${NFA_EN}`, dataComplete: true }, { approvalMode: 'risky' })
    expect(d.requiresApproval).toBe(true)
  })
  it('yang diblokir selalu terlihat reviewer', () => {
    const d = evaluate({ type: 'daily_summary', text: 'beli', dataComplete: true }, { approvalMode: 'risky' })
    expect(d.requiresApproval).toBe(true)
  })
})

describe('fail closed & log', () => {
  it('input tidak valid ditolak', () => {
    const d = evaluate({ type: 'bogus' as ContentType, text: 'halo' })
    expect(d.allowed).toBe(false)
  })
  it('alamat token tidak valid ditolak', () => {
    const d = evaluate({ type: 'daily_summary', text: 'x', dataComplete: true, tokens: [{ address: '0x12', ageSeconds: 9999 }] })
    expect(d.allowed).toBe(false)
  })
  it('log hanya menyimpan hash konten, bukan teks', () => {
    const input = { type: 'daily_summary', text: 'beli sekarang', dataComplete: true } as const
    const entry = toLogEntry(input, evaluate(input))
    expect(entry.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(entry)).not.toContain('beli sekarang')
    expect(entry.allowed).toBe(false)
  })
})
