// Red-team RiskGuard. Setiap it() = celah terkonfirmasi (harus GAGAL sampai aturan diperbaiki).
// Karakter non-ASCII/tak terlihat dibuat lewat String.fromCharCode agar tidak berubah di file.
import { describe, expect, it } from 'vitest'
import { evaluate, type ContentType, type ReasonCode, type RiskGuardInput } from '../src'

const ADDR = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const c = (...n: number[]) => String.fromCharCode(...n)

function run(text: string, type: ContentType = 'daily_summary', over: Partial<RiskGuardInput> = {}) {
  return evaluate({ type, text, dataComplete: true, ...over })
}
/** Harus diblokir oleh salah satu kode di `codes`. */
function blocked(text: string, codes: ReasonCode[], type: ContentType = 'daily_summary', over: Partial<RiskGuardInput> = {}) {
  const d = run(text, type, over)
  expect(d.allowed, `harus diblokir: "${text}"`).toBe(false)
  expect(d.reasons.some((r) => codes.includes(r)), `kode ${codes.join('/')} diharapkan, dapat [${d.reasons}] untuk "${text}"`).toBe(true)
}
function passes(text: string, type: ContentType = 'daily_summary', over: Partial<RiskGuardInput> = {}) {
  const d = run(text, type, over)
  expect(d.reasons, `harus lolos (false positive): "${text}"`).toEqual([])
}

describe('celah: slang & kata kerja beli/jual di luar daftar (ADVICE_PHRASE)', () => {
  it('hajar', () => blocked('Hajar NVDA sekarang', ['ADVICE_PHRASE']))
  it('cuci gudang', () => blocked('Cuci gudang sebelum turun', ['ADVICE_PHRASE']))
  it('accumulate now', () => blocked('Accumulate now before the pump', ['ADVICE_PHRASE']))
  it('load up', () => blocked('Load up on this token while it is cheap', ['ADVICE_PHRASE']))
  it('scoop up', () => blocked('Scoop up this dip', ['ADVICE_PHRASE']))
  it('go long / short it', () => blocked('Go long NVDA, short the rest', ['ADVICE_PHRASE']))
  it('gaskeun', () => blocked('Gaskeun masuk sekarang', ['ADVICE_PHRASE']))
  it('belinya (sufiks -nya)', () => blocked('Belinya sekarang sebelum naik', ['ADVICE_PHRASE']))
  it('ngejual / dijualnya', () => blocked('Mending ngejual semuanya', ['ADVICE_PHRASE']))
  it('purchase now', () => blocked('Purchase now while early', ['ADVICE_PHRASE']))
  it('take profits (jamak)', () => blocked('Time to take profits', ['ADVICE_PHRASE', 'PRICE_TARGET']))
  it('kata digabung: buynow / #BuyNVDA', () => blocked('#BuyNVDA buynow', ['ADVICE_PHRASE']))
  it('kata digabung: jualsemua', () => blocked('jualsemua hari ini', ['ADVICE_PHRASE']))
})

describe('celah: "pasti naik" & frasa jaminan dengan sisipan', () => {
  it('pasti/naik tanpa spasi', () => blocked('pasti/naik minggu ini', ['ADVICE_PHRASE']))
  it('pasti-naik', () => blocked('pasti-naik', ['ADVICE_PHRASE']))
  it('pasti_naik', () => blocked('pasti_naik besok', ['ADVICE_PHRASE']))
  it('pecah acak: pa sti naik', () => blocked('pa sti naik', ['ADVICE_PHRASE']))
  it('pasti bakal naik', () => blocked('Pasti bakal naik', ['ADVICE_PHRASE']))
  it('pasti 100% naik', () => blocked('Pasti 100% naik', ['ADVICE_PHRASE']))
  it('definitely will pump', () => blocked('This will definitely pump', ['ADVICE_PHRASE']))
  it('certain to rise', () => blocked('NVDA is certain to rise', ['ADVICE_PHRASE']))
  it('only up / easy money', () => blocked('Only up from here, easy money', ['ADVICE_PHRASE']))
  it('all-in', () => blocked('all-in on NVDA', ['ADVICE_PHRASE']))
  it('allin', () => blocked('allin sekarang', ['ADVICE_PHRASE']))
  it('all_in', () => blocked('go all_in', ['ADVICE_PHRASE']))
  it('tothemoon', () => blocked('tothemoon', ['ADVICE_PHRASE']))
  it('ape-in', () => blocked('ape-in now', ['ADVICE_PHRASE']))
})

describe('celah: homoglyph/karakter tak terlihat di luar peta', () => {
  it('small caps ʙᴜʏ', () => blocked(c(0x299, 0x1d1c, 0x28f) + ' now', ['ADVICE_PHRASE']))
  it('small caps ꜱᴇʟʟ', () => blocked(c(0xa731, 0x1d07, 0x29f, 0x29f) + ' everything', ['ADVICE_PHRASE']))
  it('dotless i: belı', () => blocked('bel' + c(0x131) + ' sekarang', ['ADVICE_PHRASE']))
  it('l-stroke: seł ł', () => blocked('se' + c(0x142, 0x142) + ' now', ['ADVICE_PHRASE']))
  it('Hangul filler di dalam "target"', () => blocked('Tar' + c(0x3164) + 'get: $150', ['PRICE_TARGET']))
  it('Mongolian vowel separator di dalam "target"', () => blocked('tar' + c(0x180e) + 'get 150', ['PRICE_TARGET']))
  it('braille blank di dalam "target"', () => blocked('tar' + c(0x2800) + 'get 150', ['PRICE_TARGET']))
  it('Hangul filler memutus domain', () => blocked('nexa' + c(0x3164) + '.ai', ['URL']))
  it('Armenian n di $NEXA', () => blocked('$' + c(0x578) + 'exa naik', ['NEXA_MENTION'], 'prediction'))
})

describe('celah: target harga dengan frasa tak lazim', () => {
  it('targeting', () => blocked('Targeting $150 by Friday', ['PRICE_TARGET']))
  it('targets', () => blocked('Analysts targets $150', ['PRICE_TARGET']))
  it('target is somewhere around (>15 char)', () => blocked('The target is somewhere around $150', ['PRICE_TARGET']))
  it('tp1', () => blocked('TP1 150 TP2 170', ['PRICE_TARGET']))
  it('stop-loss berhubung tanda hubung', () => blocked('stop-loss di 90', ['PRICE_TARGET']))
  it('take-profit', () => blocked('take-profit 150', ['PRICE_TARGET']))
  it('to ~$150', () => blocked('NVDA to ~$150 soon', ['PRICE_TARGET']))
  it('to around $150', () => blocked('will reach around $150', ['PRICE_TARGET']))
  it('to 150 dollars', () => blocked('NVDA will reach 150 dollars', ['PRICE_TARGET']))
  it('menuju 150 dolar', () => blocked('NVDA menuju 150 dolar', ['PRICE_TARGET']))
  it('mata uang di belakang: 150$', () => blocked('NVDA to 150$ next week', ['PRICE_TARGET']))
  it('fair value', () => blocked('Fair value $200, upside 40%', ['PRICE_TARGET']))
  it('price will be', () => blocked('Price will be $150 next week', ['PRICE_TARGET']))
  it('akan jadi Rp', () => blocked('Harga bakal jadi Rp 5000 minggu depan', ['PRICE_TARGET']))
})

describe('celah: URL tersamar', () => {
  it('spasi di sekitar titik', () => blocked('cek nexa . ai', ['URL']))
  it('titik ideografis U+3002', () => blocked('cek nexa' + c(0x3002) + 'ai', ['URL']))
  it('TLD .tech', () => blocked('pons.tech', ['URL']))
  it('TLD .exchange', () => blocked('swap.exchange', ['URL']))
  it('TLD .vip', () => blocked('airdrop.vip', ['URL']))
  it('TLD .network', () => blocked('join.network', ['URL']))
  it('TLD .trade', () => blocked('x.trade', ['URL']))
  it('alamat IP', () => blocked('203.0.113.5/claim', ['URL']))
  it('skema ipfs://', () => blocked('ipfs://bafybeigdyrzt', ['URL']))
  it('skema tg://', () => blocked('tg://resolve?domain=nexa', ['URL']))
  it('http dengan huruf berspasi', () => blocked('h t t p s : / / n e x a . a i', ['URL']))
})

describe('celah: $NEXA di tipe terlarang / pembicaraan harga', () => {
  it('$NNEXA (huruf berulang)', () => blocked('$NNEXA hari ini', ['NEXA_MENTION'], 'prediction'))
  it('$NEXAA', () => blocked('$NEXAA hari ini', ['NEXA_MENTION'], 'prediction'))
  it('NEXA tokens (jamak)', () => blocked('NEXA tokens dibakar', ['NEXA_MENTION'], 'daily_summary'))
  it('ticker: NEXA (titik dua)', () => blocked('ticker: NEXA', ['NEXA_MENTION'], 'daily_summary'))
  it('tokennya NEXA', () => blocked('tokennya NEXA ramai', ['NEXA_MENTION'], 'daily_summary'))
  it('NEXA/NVDA pool', () => blocked('NEXA/NVDA pool ramai', ['NEXA_MENTION'], 'daily_summary'))
  it('NEXA holders', () => blocked('NEXA holders bertambah 300', ['NEXA_MENTION'], 'daily_summary'))
  it('harga NEXA tanpa $ (aturan emas)', () => blocked('Harga NEXA naik 30% hari ini', ['NEXA_PRICE', 'NEXA_MENTION']))
  it('NEXA price/mcap tanpa $', () => blocked('NEXA mcap 5M, price 0.5', ['NEXA_PRICE', 'NEXA_MENTION']))
  it('technical_announcement: up 40%', () => blocked('$NEXA up 40% today', ['NEXA_PRICE'], 'technical_announcement'))
  it('technical_announcement: melonjak', () => blocked('$NEXA melonjak hari ini', ['NEXA_PRICE'], 'technical_announcement'))
  it('technical_announcement: rally/surge', () => blocked('$NEXA rallied and surged', ['NEXA_PRICE'], 'technical_announcement'))
  it('burn_report: undervalued/trading at', () => blocked('Burn done. $NEXA is undervalued, trading at 0.5', ['NEXA_PRICE'], 'burn_report'))
  it('burn_report: accumulate $NEXA', () => blocked('Burn done. Accumulate $NEXA', ['ADVICE_PHRASE'], 'burn_report'))
})

describe('celah: Sponsored & rekomendasi tersirat', () => {
  it('rekomendasi tanpa kata beli', () =>
    blocked('Sponsored: our top pick, strong accumulate rating', ['ADVICE_PHRASE'], 'sponsored'))
})

describe('celah: alamat & umur token', () => {
  it('alamat tak terlacak dipecah spasi', () => {
    const spaced = OTHER.slice(2).replace(/(.{8})/g, '$1 ')
    blocked('Kontrak 0x ' + spaced, ['UNTRACKED_ADDRESS'], 'risk_report', {
      tokens: [{ address: ADDR, ageSeconds: 7200 }],
      text: 'Kontrak 0x ' + spaced + ' Bukan nasihat keuangan.',
    })
  })
  it('alamat tak terlacak dipecah tanda hubung', () => {
    const hy = OTHER.slice(2).replace(/(.{8})/g, '$1-')
    blocked('Kontrak 0x-' + hy + ' bukan nasihat keuangan', ['UNTRACKED_ADDRESS'], 'risk_report', {
      tokens: [{ address: ADDR, ageSeconds: 7200 }],
    })
  })
  it('alamat terlacak + sufiks hex dianggap terlacak (42 hex)', () => {
    blocked('Kontrak ' + ADDR + 'ab bukan nasihat keuangan', ['UNTRACKED_ADDRESS'], 'risk_report', {
      tokens: [{ address: ADDR, ageSeconds: 7200 }],
    })
  })
})

describe('celah: jawaban "tidak tahu" dipakai sebagai bypass', () => {
  it('"Data tersedia:" (klaim positif) memicu jalur unknown', () =>
    blocked('Data tersedia: NVDA oracle 142.10, whale pindahkan 5M', ['DATA_INCOMPLETE'], 'daily_summary', { dataComplete: false }))
  it('"Data lengkap" (klaim positif) memicu jalur unknown', () =>
    blocked('Data lengkap, NVDA naik 2%', ['DATA_INCOMPLETE'], 'daily_summary', { dataComplete: false }))
  it('awalan "tidak tahu" lalu klaim angka', () =>
    blocked('Tidak tahu detailnya, tapi NVDA oracle 142.10 dan whale pindahkan 5M', ['DATA_INCOMPLETE'], 'daily_summary', {
      dataComplete: false,
    }))
  it('awalan "tidak tahu" melewati disclaimer prediksi', () =>
    blocked('Tidak tahu pasti, tapi NVDA naik 5% dalam 7 hari', ['MISSING_DISCLAIMER'], 'prediction', { dataComplete: false }))
})

describe('false positive: laporan data yang jelas tidak berbahaya', () => {
  it('harga oracle "moved to $142.10"', () => passes('NVDA oracle price moved to $142.10 from $140.00'))
  it('harga "ke Rp 2000" (laporan)', () => passes('Kurs oracle bergerak ke Rp 16000 hari ini'))
  it('volume "hit $5M"', () => passes('Daily volume on the Pons pool hit $5M'))
  it('"Target Corp" (nama perusahaan)', () => passes('Target Corp rose 3% on Stock Token feed'))
  // KEPUTUSAN (DECISIONS.md): kata beli/jual/buy/sell diblokir di semua bentuk, termasuk laporan data.
  // Persona harus menulis "volume masuk/keluar" atau "transaksi akumulasi/distribusi". Over-block diterima.
  it('buy/sell volume tetap diblokir (kebijakan ketat)', () =>
    blocked('Buy volume 60% vs sell volume 40% on the Pons pool', ['ADVICE_PHRASE']))
  it('"buys" tetap diblokir (kebijakan ketat)', () => blocked('Pons launch saw 40 buys in 10 minutes', ['ADVICE_PHRASE']))
  it('angka 531 (dibaca "sel")', () => passes('Token ini punya 531 holders'))
  it('angka 5311 (dibaca "sell")', () => passes('Pons V2 mencatat 5311 trades hari ini'))
  it('"411 in" (dibaca "all in")', () => passes('Ada 411 in the last hour'))
  it('hash transaksi 0x + 64 hex', () => passes('Tx 0x' + 'ab'.repeat(32) + ' terkonfirmasi'))
  // "stabil.Info" identik bentuknya dengan domain "stabil.info"; tidak bisa dibedakan secara aman. Over-block diterima.
  it('titik tanpa spasi bertemu TLD tetap diblokir ("stabil.Info")', () => blocked('Harga ETH stabil.Info lengkap menyusul', ['URL']))
  it('kata "guaranteed" teknis', () => passes('Chainlink heartbeat: update guaranteed within 1h'))
  it('burn_report menyebut liquidity/pairing (bukan harga)', () =>
    passes('$NEXA burned 50,000 via BurnVault. Pairing NVDA tidak berubah.', 'burn_report'))
})
