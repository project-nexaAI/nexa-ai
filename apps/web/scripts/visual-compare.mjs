// Jalankan di: ROOT/apps/web (server `next start -p 3000` harus sudah hidup).
// Membandingkan HTML asli (docs/html-design/nexa-1.html) dengan halaman Next.js:
//  1) tata letak: posisi/tinggi tiap section, 2) selisih piksel screenshot penuh.
// Elemen acak/WebGL (hash contoh, hitung mundur, canvas) di-mask supaya perbandingan adil.
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const ORIGINAL = pathToFileURL(resolve('../../docs/html-design/nexa-1.html')).href
const NEXT_URL = process.env.WEB_URL ?? 'http://localhost:3000'
const OUT = resolve('.visual')
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const SECTIONS = ['#nav', '#hero', '.marquee', '#proof', '#feed', '#how', '#pricing', '#rules', '#token', '#roadmap', '#cta', 'footer']
const MASK = ['#hero3d', '#embers', '#cta3d', '#exHash', '#exCount', '#exBar', '#copyHash']

async function prepare(page, url, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  // Munculkan semua elemen reveal (animasi masuk bergantung scroll) lalu kembali ke atas.
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => scrollTo(0, yy), y)
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(1800)
  await page.addStyleTag({
    content: `${MASK.join(',')}{visibility:hidden!important} *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
  })
}

async function measure(page) {
  return page.evaluate((sels) => {
    const out = {}
    for (const s of sels) {
      const el = document.querySelector(s)
      if (!el) {
        out[s] = null
        continue
      }
      const r = el.getBoundingClientRect()
      out[s] = { top: Math.round(r.top + scrollY), height: Math.round(r.height) }
    }
    out.__docHeight = document.documentElement.scrollHeight
    return out
  }, SECTIONS)
}

const report = []
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: process.env.PW_WEBGL === '1' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-webgl', '--disable-3d-apis'] })
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    const errors = []
    async function capture(url, trackErrors) {
      const page = await ctx.newPage()
      if (trackErrors) {
        page.on('pageerror', (e) => errors.push(String(e)))
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      }
      await prepare(page, url, vp)
      const metrics = await measure(page)
      const png = PNG.sync.read(await page.screenshot({ fullPage: true, timeout: 120_000 }))
      await page.close()
      return { metrics, png }
    }
    const A = await capture(ORIGINAL, false)
    const B = await capture(NEXT_URL, true)
    const ma = A.metrics
    const mb = B.metrics
    const layout = SECTIONS.concat('__docHeight').map((s) => {
      const x = ma[s]
      const y = mb[s]
      if (s === '__docHeight') return { section: 'document', original: x, next: y, ok: Math.abs(x - y) <= 2 }
      if (!x || !y) return { section: s, original: x, next: y, ok: false }
      return { section: s, original: x, next: y, ok: Math.abs(x.top - y.top) <= 2 && Math.abs(x.height - y.height) <= 2 }
    })

    const pa = A.png
    const pb = B.png
    const w = Math.min(pa.width, pb.width)
    const h = Math.min(pa.height, pb.height)
    const crop = (p) => {
      const o = new PNG({ width: w, height: h })
      PNG.bitblt(p, o, 0, 0, w, h, 0, 0)
      return o
    }
    const ca = crop(pa)
    const cb = crop(pb)
    const diff = new PNG({ width: w, height: h })
    const bad = pixelmatch(ca.data, cb.data, diff.data, w, h, { threshold: 0.15 })
    writeFileSync(`${OUT}/${vp.name}-original.png`, PNG.sync.write(ca))
    writeFileSync(`${OUT}/${vp.name}-next.png`, PNG.sync.write(cb))
    writeFileSync(`${OUT}/${vp.name}-diff.png`, PNG.sync.write(diff))
    report.push({ viewport: vp.name, size: { original: [pa.width, pa.height], next: [pb.width, pb.height] }, diffPercent: +((bad / (w * h)) * 100).toFixed(3), layout, consoleErrors: errors })
    await ctx.close()
  }
} finally {
  await browser.close()
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
let failed = false
for (const r of report) {
  console.log(`\n[${r.viewport}] ukuran asli=${r.size.original} next=${r.size.next} selisih piksel=${r.diffPercent}%`)
  for (const l of r.layout) {
    if (!l.ok) failed = true
    console.log(`  ${l.ok ? 'OK  ' : 'BEDA'} ${l.section}: asli=${JSON.stringify(l.original)} next=${JSON.stringify(l.next)}`)
  }
  if (r.consoleErrors.length) console.log('  error konsol Next:', r.consoleErrors.slice(0, 5))
}
process.exit(failed ? 1 : 0)
