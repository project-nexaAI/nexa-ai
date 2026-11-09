'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Pratinjau maskot NEXA (pengganti bola hero).
 * - Gambar tunggal dirender lewat WebGL dengan peta kedalaman buatan (wajah menonjol, rambut/latar di belakang),
 *   sehingga bisa "menengok" kiri, kanan, atas, bawah (parallax 2.5D) dan pupil ikut melirik.
 * - Menengok mengikuti kursor; bila kursor diam > 2,5 dtk, maskot menengok sendiri.
 * - Lapisan tambahan: halo berdenyut, cincin orbit, kilau mata, sapuan cahaya, bara api.
 * - Tanpa WebGL atau dengan "reduce motion": jatuh ke gambar statis.
 */

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;uv.y=1.-uv.y;gl_Position=vec4(p,0.,1.);}`
const FRAG = `precision highp float;
uniform sampler2D tex;uniform vec2 look;varying vec2 uv;
float blob(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return exp(-dot(d,d));}
float depth(vec2 p){
  float face=blob(p,vec2(.5,.43),vec2(.25,.33));
  float nose=blob(p,vec2(.5,.52),vec2(.07,.10))*.35;
  float hair=blob(p,vec2(.5,.36),vec2(.45,.44))*.4;
  float body=blob(p,vec2(.5,.95),vec2(.6,.24))*.5;
  return clamp(face*.9+nose+hair+body,0.,1.2);
}
void main(){
  float d=depth(uv);
  vec2 off=look*vec2(.03,.02)*(d-.30);
  // pupil melirik ke arah tengok
  float eyes=blob(uv,vec2(.405,.37),vec2(.05,.03))+blob(uv,vec2(.61,.37),vec2(.05,.03));
  off+=look*vec2(.006,.004)*eyes;
  vec2 q=uv-off;
  vec3 c=texture2D(tex,clamp(q,.001,.999)).rgb;
  gl_FragColor=vec4(c,1.);
}`

export function MascotStage() {
  const root = useRef<HTMLDivElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)
  const embers = useRef<HTMLCanvasElement>(null)
  const poseRef = useRef<HTMLCanvasElement>(null)
  const [gl, setGl] = useState(false)
  const [pz, setPz] = useState(false)

  useEffect(() => {
    const el = root.current
    const cv = embers.current
    const gc = glRef.current
    const pc = poseRef.current
    if (!el || !cv || !gc || !pc) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // ---- WebGL: gambar + kedalaman buatan
    const g = gc.getContext('webgl', { premultipliedAlpha: false, antialias: true })
    let uLook: WebGLUniformLocation | null = null
    let glReady = false
    const img = new Image()
    img.src = '/mascot.webp'
    img.onload = () => {
      if (!g) return
      const mk = (type: number, src: string) => {
        const s = g.createShader(type)!
        g.shaderSource(s, src)
        g.compileShader(s)
        return s
      }
      const prog = g.createProgram()!
      g.attachShader(prog, mk(g.VERTEX_SHADER, VERT))
      g.attachShader(prog, mk(g.FRAGMENT_SHADER, FRAG))
      g.linkProgram(prog)
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) return
      g.useProgram(prog)
      const buf = g.createBuffer()
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
      const loc = g.getAttribLocation(prog, 'p')
      g.enableVertexAttribArray(loc)
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
      const tex = g.createTexture()
      g.bindTexture(g.TEXTURE_2D, tex)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, img)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      uLook = g.getUniformLocation(prog, 'look')
      glReady = true
      setGl(true)
    }

    // ---- grid pose 7x7 (baris = atas..bawah, kolom = kiri..kanan): /mascot/f_{baris}_{kolom}.webp
    // dan varian mata terpejam f_{baris}_{kolom}_b.webp. Arah tengok = campuran bilinear 4 frame tetangga;
    // karena selisih antar frame kecil, hasilnya tidak berbayang. Frame tengah dimuat dulu, sisanya bertahap.
    const N = 13 // grid halus 13x13: 49 frame asli + 120 frame hasil interpolasi optical-flow (public/mascot/g)
    const MID = 6
    const NS = 7 // frame mata terpejam hanya 7x7 (sel terdekat dipakai)
    const open: (HTMLImageElement | undefined)[] = new Array(N * N)
    const shut: (HTMLImageElement | undefined)[] = new Array(NS * NS)
    let poseReady = false
    const order: [number, number][] = []
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) order.push([r, c])
    order.sort((a, b) => Math.hypot(a[0] - MID, a[1] - MID) - Math.hypot(b[0] - MID, b[1] - MID))
    const load = (arr: (HTMLImageElement | undefined)[], r: number, c: number, src: string, w: number) => {
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => {
        arr[r * w + c] = im
        if (!poseReady && open[MID * N + MID]) {
          poseReady = true
          setPz(true)
        }
      }
      im.src = src
    }
    // Nama file: o_{kolom}_{baris} (x dulu, lalu y). open[] diindeks [baris*N+kolom].
    for (const [r, c] of order) load(open, r, c, `/mascot/g/o_${c}_${r}.webp`, N)
    for (let r = 0; r < NS; r++) for (let c = 0; c < NS; c++) load(shut, r, c, `/mascot/f_${c}_${r}_b.webp`, NS)

    // satu frame tajam per saat: pilih sel grid terdekat (dengan histeresis supaya tidak berkedip di batas),
    // pindah antar sel lewat crossfade singkat berbasis WAKTU (bukan posisi), jadi tidak pernah diam di kondisi berbayang
    const FADE = 110
    const STEP = 0.008 // geser per langkah grid, fraksi lebar kanvas
    let curR = MID
    let curC = MID
    let fromR = MID
    let fromC = MID
    let fadeAt = -1e9
    const pick = (cur: number, x: number) => {
      const u = ((Math.max(-1, Math.min(1, x)) + 1) / 2) * (N - 1)
      return Math.abs(u - cur) > 0.56 ? Math.max(0, Math.min(N - 1, Math.round(u))) : cur
    }
    const pctx = pc.getContext('2d')
    // kedip acak tiap 2,5-6 dtk, lama 170 ms
    let nextBlink = performance.now() + 2500
    let blinkAt = -1
    const drawPose = (lx: number, ly: number, now: number) => {
      if (!pctx) return
      const uu = ((Math.max(-1, Math.min(1, lx)) + 1) / 2) * (N - 1)
      const vv = ((Math.max(-1, Math.min(1, ly)) + 1) / 2) * (N - 1)
      // blend bilinear 4 frame tetangka: posisi kontinu -> gerak mulus tanpa lompatan antar sel.
      // Grid 13x13 sangat rapat sehingga selisih antar frame kecil dan hasil blend tidak berbayang.
      void pick; void FADE; void STEP; void fromR; void fromC; void fadeAt; void curR; void curC
      pctx.clearRect(0, 0, pc.width, pc.height)
      pctx.imageSmoothingEnabled = true
      pctx.imageSmoothingQuality = 'high'
      const W = pc.width
      const Z = 1.035
      const c0 = Math.min(N - 2, Math.floor(uu))
      const r0 = Math.min(N - 2, Math.floor(vv))
      // smoothstep pada bobot: waktu di kondisi campuran lebih singkat -> lebih sering tampil satu frame tajam, tetap kontinu
      const ss = (v: number) => v * v * (3 - 2 * v)
      const fx = ss(uu - c0)
      const fy = ss(vv - r0)
      const cells: [number, number, number][] = [
        [r0, c0, (1 - fx) * (1 - fy)],
        [r0, c0 + 1, fx * (1 - fy)],
        [r0 + 1, c0, (1 - fx) * fy],
        [r0 + 1, c0 + 1, fx * fy],
      ]
      // gambar dari bobot terbesar; alpha kumulatif = w / (jumlah bobot sejauh ini) agar hasil tepat proporsional
      cells.sort((a, b) => b[2] - a[2])
      let acc = 0
      let cr = MID
      let cc = MID
      let best = -1
      for (const [r, c, w] of cells) {
        const im = open[r * N + c]
        if (!im || w <= 0.001) continue
        acc += w
        if (w > best) {
          best = w
          cr = r
          cc = c
        }
        pctx.globalAlpha = w / acc
        pctx.drawImage(im, -(W * (Z - 1)) / 2, -(W * (Z - 1)) / 2, W * Z, W * Z)
      }
      pctx.globalAlpha = 1
      if (best < 0) {
        const im = open[MID * N + MID]
        if (im) pctx.drawImage(im, -(W * (Z - 1)) / 2, -(W * (Z - 1)) / 2, W * Z, W * Z)
      }
      const curR2 = cr
      const curC2 = cc
      if (now >= nextBlink) {
        blinkAt = now
        nextBlink = now + 2500 + Math.random() * 3500
      }
      const k = blinkAt < 0 ? 1 : (now - blinkAt) / 170
      const cl = shut[Math.round(curR2 / 2) * NS + Math.round(curC2 / 2)]
      if (k >= 0 && k < 1 && cl) {
        pctx.globalAlpha = Math.sin(Math.PI * k)
        pctx.drawImage(cl, 0, 0, pc.width, pc.height)
        pctx.globalAlpha = 1
      }
    }

    // ---- arah tengok: kursor, atau gerak otomatis saat kursor diam
    let mx = 0
    let my = 0
    let lastMove = -1e9
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.45)))
      my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.45)))
      lastMove = performance.now()
    }
    window.addEventListener('pointermove', onMove)

    // ---- bara api
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    const resize = () => {
      const r = cv.getBoundingClientRect()
      w = r.width
      h = r.height
      cv.width = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const s = Math.min(1350, Math.round(gc.getBoundingClientRect().width * dpr))
      if (s > 0 && gc.width !== s) {
        gc.width = s
        gc.height = s
        // kanvas pose mengikuti ukuran tampil (x DPR) agar tidak diskalakan dua kali oleh browser (lebih tajam)
        pc.width = s
        pc.height = s
      }
    }
    resize()
    window.addEventListener('resize', resize)
    type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }
    const spawn = (): P => ({
      x: Math.random() * w,
      y: h * (0.55 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.25 + Math.random() * 0.7),
      r: 0.6 + Math.random() * 1.8,
      life: 0,
      max: 160 + Math.random() * 200,
    })
    const ps: P[] = []
    for (let i = 0; i < 52; i++) {
      const p = spawn()
      p.life = Math.random() * p.max
      ps.push(p)
    }

    let lx = 0
    let ly = 0
    let sx1 = 0
    let sy1 = 0
    let raf = 0
    let prev = performance.now()
    const start = prev
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000))
      prev = now
      const idle = now - lastMove > 2500
      // gerak otomatis: kanan-kiri lebar, atas-bawah lebih kecil, periode berbeda supaya tidak berulang
      const tx = idle ? Math.sin(t * 0.5) : mx
      const ty = idle ? Math.sin(t * 0.37 + 1.2) * 0.85 : my
      // smoothing dua tahap berbasis waktu (independen refresh rate): ease-in & ease-out halus
      const a1 = 1 - Math.exp(-dt * 9)
      const a2 = 1 - Math.exp(-dt * 6)
      sx1 += (tx - sx1) * a1
      sy1 += (ty - sy1) * a1
      lx += (sx1 - lx) * a2
      ly += (sy1 - ly) * a2
      el.style.setProperty('--lx', lx.toFixed(3))
      el.style.setProperty('--ly', ly.toFixed(3))

      if (poseReady) {
        drawPose(lx, ly, now)
      } else if (glReady && g) {
        g.viewport(0, 0, gc.width, gc.height)
        g.uniform2f(uLook, lx, ly)
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
      }

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const p of ps) {
        p.life += 1
        if (p.life > p.max) Object.assign(p, spawn())
        p.x += p.vx + Math.sin((p.life + p.x) * 0.02) * 0.15
        p.y += p.vy
        const a = Math.sin(Math.PI * (p.life / p.max)) * 0.85
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
        gr.addColorStop(0, `rgba(255,170,90,${a})`)
        gr.addColorStop(1, 'rgba(255,90,31,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={`mx${gl ? ' mx-on' : ''}${pz ? ' mx-pz' : ''}`} ref={root}>
      <div className="mx-halo" aria-hidden="true" />
      <svg className="mx-ring mx-ring-a" viewBox="0 0 400 400" aria-hidden="true">
        <ellipse cx="200" cy="200" rx="190" ry="62" />
      </svg>
      <svg className="mx-ring mx-ring-b" viewBox="0 0 400 400" aria-hidden="true">
        <ellipse cx="200" cy="200" rx="172" ry="52" />
      </svg>
      <div className="mx-body">
        <div className="mx-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mx-img" src="/mascot.webp" alt="NEXA, the AI agent mascot" width={1254} height={1254} />
          <canvas className="mx-pose" ref={poseRef} aria-hidden="true" />
          <canvas className="mx-gl" ref={glRef} width={1254} height={1254} aria-hidden="true" />
          <i className="mx-eye mx-eye-l" aria-hidden="true" />
          <i className="mx-eye mx-eye-r" aria-hidden="true" />
          <i className="mx-sweep" aria-hidden="true" />
          <i className="mx-scan" aria-hidden="true" />
        </div>
      </div>
      <canvas className="mx-embers" ref={embers} aria-hidden="true" />
    </div>
  )
}
