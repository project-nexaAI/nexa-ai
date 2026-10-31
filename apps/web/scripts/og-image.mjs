// Jalankan di: ROOT/apps/web  ->  node scripts/og-image.mjs
// Membuat public/og-image.png (1200x630) dari desain:
//  - latar: scene 3D asli dari nexa-1.html (bola gelap + visor oranye + cincin), ditangkap lewat WebGL
//  - logo: simbol #nx-mark dari sprite desain, dipakai apa adanya (tidak dibuat ulang)
//  - teks: font, warna, dan gaya heading dari desain (Geist, Instrument Serif, --org-2)
// Teks diambil dari tagline brief: "Every call on-chain. No deleted tweets."
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const SRC = resolve('../../docs/html-design/nexa-1.html')
const OUT = resolve('public/og-image.png')
mkdirSync(resolve('public'), { recursive: true })

const html = readFileSync(SRC, 'utf8')
const mark = html.match(/<symbol id="nx-mark" viewBox="0 0 64 64">([\s\S]*?)<\/symbol>/)?.[1]
if (!mark) throw new Error('simbol nx-mark tidak ditemukan di desain')

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'msedge',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

  // 1) Scene 3D asli; semua teks hero disembunyikan.
  const scene = await ctx.newPage()
  await scene.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle', timeout: 90_000 })
  await scene.addStyleTag({ content: '#nav,.copy-a,.copy-b,.stage-foot,.prog,.mnav{display:none!important}' })
  await scene.waitForTimeout(6000)
  const bg = (await scene.screenshot({ timeout: 120_000 })).toString('base64')
  await scene.close()

  // 2) Komposisi akhir dengan token desain.
  const page = await ctx.newPage()
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
:root{--bg:#0A0A0A;--ink:#F2EFEA;--ink-2:#A7A29C;--ink-3:#6E6A66;--org:#FF5A1F;--org-2:#FF7A3D;--line-2:#333;
--sans:"Geist",system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace;--serif:"Instrument Serif",Georgia,serif}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;background:var(--bg);overflow:hidden}
body{position:relative;color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:url(data:image/png;base64,${bg}) center/cover no-repeat}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,10,10,.92) 0%,rgba(10,10,10,.78) 34%,rgba(10,10,10,0) 58%)}
.logo{position:absolute;left:72px;top:60px;display:inline-flex;align-items:center;gap:14px;font-weight:600;font-size:26px;letter-spacing:.06em}
.logo svg{width:44px;height:44px}
h1{position:absolute;left:72px;top:200px;font-weight:300;font-size:84px;line-height:1.0;letter-spacing:-.045em}
h1 em{display:block;margin-top:14px;font-family:var(--serif);font-style:italic;font-weight:400;font-size:70px;letter-spacing:-.01em;color:var(--org-2)}
.foot{position:absolute;left:72px;bottom:56px;font-family:var(--mono);font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
</style></head><body>
<div class="bg"></div><div class="fade"></div>
<div class="logo"><svg viewBox="0 0 64 64" role="img" aria-label="NEXA logo">${mark}</svg><span>NEXA</span></div>
<h1>Every call<br>on-chain.<em>No deleted tweets.</em></h1>
<div class="foot">NexaLedger &middot; Robinhood Chain</div>
</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  const fontsOk = await page.evaluate(
    () => document.fonts.check('300 40px Geist') && document.fonts.check('italic 40px "Instrument Serif"') && document.fonts.check('16px "Geist Mono"'),
  )
  if (!fontsOk) throw new Error('font desain (Geist / Instrument Serif / Geist Mono) gagal dimuat; periksa koneksi internet')
  writeFileSync(OUT, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } }))
  console.log('ditulis:', OUT)
} finally {
  await browser.close()
}
