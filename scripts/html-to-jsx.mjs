// Jalankan di: ROOT. Bootstrap SEKALI dari docs/html-design/nexa-1.html -> apps/web.
// PERINGATAN: menjalankan ulang menimpa komponen dan lib/landing-*.ts (termasuk tambalan data).
// Hasilnya di-commit dan menjadi sumber kebenaran baru (boleh diedit tangan); skrip ini hanya untuk
// membuat ulang dari nol atau saat "HTML revisi". Tampilan tidak diubah: markup dikonversi mekanis.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseDocument } from 'htmlparser2'

const SRC = 'docs/html-design/nexa-1.html'
const OUT = 'apps/web/src'
const html = readFileSync(SRC, 'utf8')
const doc = parseDocument(html, { lowerCaseTags: false, lowerCaseAttributeNames: false, decodeEntities: true })

const find = (node, pred) => {
  if (pred(node)) return node
  for (const c of node.children ?? []) {
    const r = find(c, pred)
    if (r) return r
  }
  return null
}

// ------------------------------------------------------------------ JSX
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const BOOL = new Set(['hidden', 'disabled', 'checked', 'async', 'defer', 'autofocus', 'controls', 'loop', 'muted', 'selected', 'required'])
const RENAME = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', crossorigin: 'crossOrigin', readonly: 'readOnly', playsinline: 'playsInline', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', 'xmlns:xlink': 'xmlnsXlink' }
const NO_WS_PARENTS = new Set(['table', 'tbody', 'thead', 'tfoot', 'tr', 'colgroup', 'select'])
const X_PLACEHOLDER = 'https://x.com/__X_HANDLE__'

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function attrName(name) {
  if (RENAME[name]) return RENAME[name]
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  return name.includes('-') ? camel(name) : name
}

function styleObject(css) {
  const entries = css
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':')
      const k = d.slice(0, i).trim()
      const v = d.slice(i + 1).trim()
      const key = k.startsWith('--') ? JSON.stringify(k) : camel(k)
      return `${key}: ${JSON.stringify(v)}`
    })
  return `{{ ${entries.join(', ')} }}`
}

let usesSite = false
function attrs(el) {
  const out = []
  for (const [name, value] of Object.entries(el.attribs)) {
    const key = attrName(name)
    if (name === 'tabindex') out.push(`tabIndex={${Number(value)}}`)
    else if (name === 'style') out.push(`style=${styleObject(value)}`)
    else if (value === X_PLACEHOLDER) {
      usesSite = true
      out.push(`${key}={X_URL}`)
    } else if (value === '' && BOOL.has(name)) out.push(key)
    else if (/^[^"{}\n\\&<>]*$/.test(value)) out.push(`${key}="${value}"`)
    else out.push(`${key}={${JSON.stringify(value)}}`)
  }
  return out.length ? ' ' + out.join(' ') : ''
}

function textNode(data, ctx) {
  if (/^\s*$/.test(data)) return null
  const t = data.replace(/\s+/g, ' ')
  return /[{}<>&]/.test(t) || /^ | $/.test(t) ? `{${JSON.stringify(t)}}` : t
}

function render(node, depth, ctx) {
  const pad = '  '.repeat(depth)
  if (node.type === 'comment') return null
  if (node.type === 'text') {
    const t = textNode(node.data, ctx)
    return t === null ? null : pad + t
  }
  if (node.type !== 'tag') return null
  const name = node.name
  const inSvg = ctx.inSvg || name === 'svg'
  const kids = node.children ?? []
  const lines = []
  kids.forEach((c, i) => {
    if (c.type === 'text' && /^\s*$/.test(c.data)) {
      // Spasi antar-elemen inline harus dipertahankan seperti di HTML (hanya di luar SVG/tabel).
      if (!inSvg && !NO_WS_PARENTS.has(name) && i > 0 && i < kids.length - 1) lines.push(pad + '  {" "}')
      return
    }
    const r = render(c, depth + 1, { inSvg })
    if (r !== null) lines.push(r)
  })
  const open = `<${name}${attrs(node)}`
  if (VOID.has(name) || lines.length === 0) return `${pad}${open} />`
  return `${pad}${open}>\n${lines.join('\n')}\n${pad}</${name}>`
}

function component(name, nodes, { fragment = false } = {}) {
  usesSite = false
  const body = nodes.map((n) => render(n, fragment ? 3 : 2, { inSvg: false })).filter(Boolean)
  const inner = fragment ? `    <>\n${body.join('\n')}\n    </>` : body.join('\n').replace(/^ {2}/gm, '  ')
  const imp = usesSite ? "import { X_URL } from '@/lib/site'\n\n" : ''
  return `${imp}export function ${name}() {\n  return (\n${inner}\n  )\n}\n`
}

// ------------------------------------------------------------ body -> komponen
const body = find(doc, (n) => n.name === 'body')
const top = body.children.filter((c) => c.type === 'tag' && c.name !== 'script')
const byId = (id) => top.find((n) => n.attribs?.id === id)
const main = top.find((n) => n.name === 'main')
const sectionOf = (id) => main.children.find((c) => c.type === 'tag' && c.attribs.id === id)

const parts = {
  Sprite: [top.find((n) => n.name === 'svg')],
  Nav: [top.find((n) => n.name === 'header'), byId('mnav')],
  Hero: [byId('hero')],
  Marquee: [top.find((n) => n.attribs?.class === 'marquee')],
  Proof: [sectionOf('proof')],
  Feed: [sectionOf('feed')],
  How: [sectionOf('how')],
  Pricing: [sectionOf('pricing')],
  Rules: [sectionOf('rules')],
  Token: [sectionOf('token')],
  Roadmap: [sectionOf('roadmap')],
  Cta: [byId('cta')],
  Footer: [top.find((n) => n.name === 'footer')],
}

mkdirSync(`${OUT}/components/landing`, { recursive: true })
for (const [name, nodes] of Object.entries(parts)) {
  if (nodes.some((n) => !n)) throw new Error(`bagian ${name} tidak ditemukan`)
  const header = `// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.\n`
  writeFileSync(`${OUT}/components/landing/${name}.tsx`, header + component(name, nodes, { fragment: nodes.length > 1 }))
}

// ------------------------------------------------------------------- CSS
const styleText = find(doc, (n) => n.name === 'style').children[0].data
const rootStart = styleText.indexOf(':root{')
const rootEnd = styleText.indexOf('}', rootStart) + 1
mkdirSync(`${OUT}/styles`, { recursive: true })
writeFileSync(`${OUT}/styles/tokens.css`, `/* Design tokens dari desain (warna, font, radius, easing). */\n${styleText.slice(rootStart, rootEnd).replace(/\{/, ' {\n  ').replace(/;(?!\s*\})/g, ';\n  ').replace(/\s*\}$/, '\n}')}\n`)
writeFileSync(`${OUT}/styles/landing.css`, styleText.slice(0, rootStart) + styleText.slice(rootEnd) + '\n')

// ----------------------------------------------------------------- skrip
const scripts = []
const walkScripts = (n) => {
  if (n.name === 'script') scripts.push(n)
  for (const c of n.children ?? []) walkScripts(c)
}
walkScripts(body)
const classic = scripts.find((s) => !s.attribs.type)
const module3d = scripts.find((s) => s.attribs.type === 'module')
const text = (s) => s.children.map((c) => c.data).join('')

mkdirSync(`${OUT}/lib`, { recursive: true })
writeFileSync(
  `${OUT}/lib/landing-motion.ts`,
  `// @ts-nocheck\n// Skrip gerak dari desain, dibungkus agar dipanggil dari efek client (lihat docs/DECISIONS.md).\nexport function initMotion(NX_DATA) {\n${text(classic)}\n}\n`,
)
const m = text(module3d)
const importLines = m.split('\n').filter((l) => l.startsWith('import '))
const rest = m.split('\n').filter((l) => !l.startsWith('import ')).join('\n')
writeFileSync(`${OUT}/lib/landing-3d.ts`, `// @ts-nocheck\n${importLines.join('\n')}\n\nexport function init3d() {\n${rest}\n}\n`)

console.log('komponen:', Object.keys(parts).join(', '))
