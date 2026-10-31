// Jalankan di: ROOT/apps/web. Server dengan FIXTURE_PROOF=populated harus hidup di WEB_URL (default :3001).
// Memastikan data API (fixture terisi) mengalir ke hash contoh, hari PoD, dan gauge win rate.
import { chromium } from 'playwright'

const URL_ = process.env.WEB_URL ?? 'http://localhost:3001'
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--disable-webgl', '--disable-3d-apis'] })
const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage()
await page.goto(URL_, { waitUntil: 'networkidle' })
await page.evaluate(() => document.querySelector('#proof').scrollIntoView())
await page.waitForTimeout(2500)

const r = await page.evaluate(() => ({
  hash: document.getElementById('exHash').textContent.replace(/\s+/g, ''),
  day: document.querySelector('.pod-big em').textContent,
  of: document.querySelector('.pod-big span').textContent,
  curIndex: [...document.querySelectorAll('#days i')].findIndex((d) => d.classList.contains('cur')),
  onCount: [...document.querySelectorAll('#days i')].filter((d) => d.classList.contains('on')).length,
  gaugeOffset: document.getElementById('gArc').style.strokeDashoffset,
  gaugeText: document.getElementById('gArc').closest('.card').querySelector('p').textContent,
}))
await browser.close()

const expect = {
  hash: '0xb3608905953b23622917d8bc13fb273ee8d23838793deb6f603b25188fe28848',
  day: 'Day 4',
  of: 'of 7',
  curIndex: 3,
  onCount: 3,
  gaugeOffset: '0.375',
}
let bad = 0
for (const [k, v] of Object.entries(expect)) {
  const ok = String(r[k]) === String(v)
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'BEDA'} ${k}: ${r[k]}`)
}
const textOk = r.gaugeText.includes('62.5%') && r.gaugeText.includes('+4.12%') && r.gaugeText.includes('8 scored')
if (!textOk) bad++
console.log(`${textOk ? 'OK  ' : 'BEDA'} gaugeText: ${r.gaugeText}`)
process.exit(bad ? 1 : 0)
