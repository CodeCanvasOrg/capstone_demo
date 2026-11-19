import { useEffect, useRef } from 'react'
import type { DesignId } from '../../../shared/brochure/designs.ts'
import { DesignThumb } from '../brochure/design_thumb'
import { Bee } from './bee'

export type FieldPhase = 'running' | 'ready' | 'failed'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  /** Seat on the finished page, and the colour the design has there. */
  tx: number
  ty: number
  color: string
  alpha: number
  /** 0–0.6: when this particle joins the page. The top of the page resolves first. */
  delay: number
  seed: number
  /** Where this particle likes to drift while unordered, as a fraction of the viewport. */
  fx: number
  fy: number
  /** Not yet carried in by Bo. */
  alive: boolean
  /** Extra pollen with no seat on the page. It fades out at the end. */
  stray: boolean
}

type Point = { x: number; y: number }
type Seat = Point & { color: string; alpha: number }

const AMBER = '#f6b81a'
const BEE_W = 64
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = (v: number) => {
  const t = clamp(v)
  return t * t * (3 - 2 * t)
}
const easeOut = (v: number) => 1 - Math.pow(1 - clamp(v), 3)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A soft round sprite in any CSS colour. Blur is just drawing it larger and fainter. */
function makeSprite(color: string) {
  const size = 64
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = size
  const g = sprite.getContext('2d')
  if (!g) return sprite
  g.fillStyle = color
  g.fillRect(0, 0, size, size)
  const mask = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  mask.addColorStop(0, 'rgba(0,0,0,1)')
  mask.addColorStop(0.4, 'rgba(0,0,0,.92)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = mask
  g.fillRect(0, 0, size, size)
  return sprite
}

let probeCtx: CanvasRenderingContext2D | null | undefined

/** Any CSS colour (including color-mix) to [r, g, b, a]. */
function parseColor(css: string): [number, number, number, number] {
  if (probeCtx === undefined) {
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    probeCtx = probe.getContext('2d', { willReadFrequently: true })
  }
  if (!probeCtx) return [0, 0, 0, 0]
  probeCtx.clearRect(0, 0, 1, 1)
  probeCtx.fillStyle = '#000'
  probeCtx.fillStyle = css
  probeCtx.fillRect(0, 0, 1, 1)
  const d = probeCtx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2], d[3] / 255]
}
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/**
 * Seats for the pollen, read from the design that is actually rendered in `ghost`: every filled
 * block, border ring and ribbon line becomes dots in the colour the design has there. A new
 * design needs no new code, and the swarm always forms what the page will look like.
 */
function seatsFromDesign(ghost: HTMLElement, max: number): { seats: Seat[]; gap: number } {
  const root = ghost.firstElementChild as HTMLElement | null
  if (!root) return { seats: [], gap: 6 }
  const frame = root.getBoundingClientRect()
  const rootColor = parseColor(getComputedStyle(root).backgroundColor)
  const dark = luminance(rootColor) < 0.35

  type Item =
    | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha: number }
    | { kind: 'ring'; cx: number; cy: number; r: number; color: string; alpha: number }
    | { kind: 'path'; pts: Point[]; color: string; alpha: number }
  const items: Item[] = []

  const usable = (rgba: number[]) => {
    if (rgba[3] < 0.04) return false
    const lum = luminance(rgba)
    if (!dark && lum > 0.92) return false
    if (Math.abs(lum - luminance(rootColor)) < 0.02 && rgba[3] > 0.9) return false
    return true
  }
  const css = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`

  root.querySelectorAll<Element>('*').forEach((el) => {
    if (el instanceof SVGPolylineElement) {
      const m = el.getScreenCTM()
      if (!m) return
      const cs = getComputedStyle(el)
      const stroke = parseColor(cs.stroke)
      const a = stroke[3] * Number.parseFloat(cs.strokeOpacity || '1')
      const total = el.getTotalLength()
      const pts: Point[] = []
      for (let s = 0; s <= total; s += 6) {
        const p = el.getPointAtLength(s)
        const q = new DOMPoint(p.x, p.y).matrixTransform(m)
        pts.push({ x: q.x, y: q.y })
      }
      if (a > 0.04) items.push({ kind: 'path', pts, color: css(stroke), alpha: a })
      return
    }
    if (!(el instanceof HTMLElement)) return
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const x0 = Math.max(r.left, frame.left)
    const y0 = Math.max(r.top, frame.top)
    const x1 = Math.min(r.right, frame.right)
    const y1 = Math.min(r.bottom, frame.bottom)
    if (x1 - x0 < 1 || y1 - y0 < 1) return
    const opacity = Number.parseFloat(cs.opacity || '1')

    let fill = parseColor(cs.backgroundColor)
    if (fill[3] < 0.04 && cs.backgroundImage.includes('gradient')) fill = parseColor(cs.color)
    if (usable(fill)) {
      items.push({
        kind: 'rect',
        x: x0,
        y: y0,
        w: x1 - x0,
        h: y1 - y0,
        color: css(fill),
        alpha: fill[3] * opacity,
      })
    }
    const bw = Number.parseFloat(cs.borderTopWidth || '0')
    const border = parseColor(cs.borderTopColor)
    if (
      bw > 0 &&
      cs.borderTopStyle !== 'none' &&
      border[3] > 0.04 &&
      cs.borderRadius.includes('%')
    ) {
      items.push({
        kind: 'ring',
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        r: r.width / 2,
        color: css(border),
        alpha: border[3] * opacity,
      })
    }
  })

  const area = items.reduce((sum, it) => (it.kind === 'rect' ? sum + it.w * it.h : sum + 600), 1)
  const gap = clamp(Math.sqrt(area / (max * 1.1)), 4, 14)
  const out: Seat[] = []
  const jitter = () => (Math.random() - 0.5) * gap * 0.35

  for (const it of items) {
    if (it.kind === 'rect') {
      const thin = Math.min(it.w, it.h) < gap * 2.2
      const g = thin ? gap : gap * 1.7
      const nx = Math.max(1, Math.round(it.w / g))
      const ny = Math.max(1, Math.round(it.h / g))
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          out.push({
            x: it.x + ((i + 0.5) / nx) * it.w + jitter(),
            y: it.y + ((j + 0.5) / ny) * it.h + jitter(),
            color: it.color,
            alpha: it.alpha,
          })
        }
      }
    } else if (it.kind === 'ring') {
      const n = Math.max(8, Math.round((Math.PI * 2 * it.r) / gap))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        out.push({
          x: it.cx + Math.cos(a) * it.r,
          y: it.cy + Math.sin(a) * it.r,
          color: it.color,
          alpha: it.alpha,
        })
      }
    } else {
      let carry = 0
      for (let i = 1; i < it.pts.length; i++) {
        const a = it.pts[i - 1]
        const b = it.pts[i]
        const d = Math.hypot(b.x - a.x, b.y - a.y)
        carry += d
        if (carry >= gap * 1.2) {
          carry = 0
          out.push({ x: b.x, y: b.y, color: it.color, alpha: it.alpha })
        }
      }
    }
  }
  // Over budget: keep an even random sample so every part of the design stays represented.
  for (let i = out.length - 1; i > 0 && out.length > max; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return { seats: out.slice(0, max), gap }
}

/**
 * Bo pollinating the first page. The whole screen fills with loose, blurred pollen that Bo
 * brings in batches from the flowers. As it is carried in, the pollen agrees on the real first
 * page design and sharpens into it, while a blurred copy of that design comes into focus beneath.
 *
 * Coordination rises on its own clock but stops short of done: there is no real progress signal,
 * so only the actual "ready" phase completes the page. "failed" dissolves the swarm instead.
 */
export function GenerationField({
  phase,
  design,
  onSettled,
}: {
  phase: FieldPhase
  design: DesignId
  onSettled: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const beeRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(phase)
  const settledRef = useRef(onSettled)
  const relayoutRef = useRef<() => void>(() => {})

  useEffect(() => {
    phaseRef.current = phase
    settledRef.current = onSettled
  })

  // A different first page: pick new seats from the design that is now rendered.
  useEffect(() => {
    relayoutRef.current()
  }, [design])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const ghost = ghostRef.current
    const beeEl = beeRef.current
    const ctx = canvas?.getContext('2d')
    if (!host || !canvas || !ghost || !beeEl || !ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = new Map<string, HTMLCanvasElement>()
    const spriteFor = (color: string) => {
      let s = sprites.get(color)
      if (!s) {
        s = makeSprite(color)
        sprites.set(color, s)
      }
      return s
    }
    const amberSprite = spriteFor(AMBER)

    let W = 0
    let H = 0
    let dpr = 1
    let gap = 6
    let page = { x: 0, y: 0, w: 0, h: 0 }
    let flowers: Point[] = []
    let particles: Particle[] = []
    let aliveCount = 0

    const layout = () => {
      const rect = host.getBoundingClientRect()
      W = rect.width
      H = rect.height
      if (!W || !H) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)

      const root = ghost.firstElementChild?.getBoundingClientRect()
      if (root) page = { x: root.left, y: root.top, w: root.width, h: root.height }

      const gx = Math.max(36, page.x * 0.45)
      const gr = Math.max(36, (W - page.x - page.w) * 0.45)
      flowers = [
        { x: gx, y: H * 0.74 },
        { x: gx * 0.9, y: H * 0.26 },
        { x: W - gr, y: H * 0.78 },
        { x: W - gr * 0.9, y: H * 0.24 },
        { x: W * 0.32, y: H - 34 },
        { x: W * 0.68, y: H - 34 },
      ]

      const max = W < 600 ? 380 : 760
      const found = seatsFromDesign(ghost, max)
      gap = found.gap
      // Seats go to random particles, so Bo's batches and the strays are spread over the page.
      const order = Array.from({ length: max }, (_, i) => i)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      if (!particles.length) {
        particles = Array.from({ length: max }, () => ({
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          color: AMBER,
          alpha: 1,
          delay: 0.6,
          seed: Math.random(),
          fx: Math.random(),
          fy: Math.random(),
          alive: false,
          stray: true,
        }))
      }
      particles.forEach((p) => {
        p.stray = true
        p.delay = 0.6
      })
      found.seats.forEach((seat, k) => {
        const p = particles[order[k]]
        if (!p) return
        p.stray = false
        p.tx = seat.x
        p.ty = seat.y
        p.color = seat.color
        p.alpha = seat.alpha
        spriteFor(seat.color)
        p.delay = clamp(((seat.y - page.y) / Math.max(1, page.h)) * 0.42 + p.seed * 0.18, 0, 0.6)
      })
    }
    layout()
    relayoutRef.current = layout
    const observer = new ResizeObserver(layout)
    observer.observe(host)

    // Bo
    const bee = { x: flowers[0]?.x ?? 0, y: flowers[0]?.y ?? 0, vx: 0, vy: 0 }
    let stop = 0
    let stopUntil = 0
    let waypoint: Point = { x: bee.x, y: bee.y }
    let atFlower = true

    // Clocks
    let last = performance.now()
    let t = 0
    let runT = 0
    let activePhase: FieldPhase = phaseRef.current
    let phaseStart = 0
    let C = 0
    let C0 = 0
    let fade = 1
    let particleFade = 1
    let settled = false
    let lastBlur = -1
    let raf = 0

    /** Bo picks up pollen: `n` more particles appear at `at`, thrown loosely around it. */
    const carryIn = (n: number, at: Point, speed: number) => {
      for (const p of particles) {
        if (n <= 0) break
        if (p.alive) continue
        p.alive = true
        aliveCount += 1
        p.x = at.x + (Math.random() - 0.5) * 36
        p.y = at.y + (Math.random() - 0.5) * 36
        const a = Math.random() * Math.PI * 2
        p.vx = bee.vx * 0.4 + Math.cos(a) * speed * (0.4 + Math.random())
        p.vy = bee.vy * 0.4 + Math.sin(a) * speed * (0.4 + Math.random())
        n -= 1
      }
    }

    const chooseStop = () => {
      if (atFlower) {
        // Leaving a flower loaded: a batch of pollen rides with Bo to the page.
        carryIn(Math.ceil(particles.length * 0.12), bee, 90)
        waypoint = {
          x: page.x + page.w * (0.15 + Math.random() * 0.7),
          y: page.y + page.h * (0.1 + Math.random() * 0.6),
        }
      } else {
        // Dropping off over the page: the whole cloud is flung across it.
        for (const p of particles) {
          if (p.alive && Math.random() < 0.5) {
            p.vx += (Math.random() - 0.5) * 220
            p.vy += (Math.random() - 0.5) * 220
          }
        }
        stop += 1
        waypoint = flowers[stop % flowers.length]
      }
      atFlower = !atFlower
      stopUntil = t + 0.9 + Math.random() * 0.5
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!W || !H) return
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      t += dt

      if (phaseRef.current !== activePhase) {
        activePhase = phaseRef.current
        phaseStart = t
        C0 = C
        settled = false
        if (activePhase === 'running') runT = 0
        if (activePhase === 'ready') {
          // Whatever Bo has not carried yet arrives from the flowers.
          particles.forEach((p, i) => {
            if (!p.alive) carryIn(1, flowers[i % flowers.length], 160)
          })
        }
      }

      // Global coordination, 0 = entropy, 1 = the finished page.
      if (activePhase === 'running') {
        runT += dt
        C = Math.min(0.88, 1 - Math.exp(-runT / 8))
        fade = 1
        particleFade = 1
      } else if (activePhase === 'ready') {
        const dur = 0.7 + 0.5 * (1 - C0)
        const s = t - phaseStart
        C = C0 + (1 - C0) * easeOut(s / dur)
        // The swarm has become the page: let the clean design stand on its own.
        particleFade = 1 - smooth((s - dur - 0.5) / 0.6)
        if (s > dur + 2.2 && !settled) {
          settled = true
          settledRef.current()
        }
      } else {
        const p = (t - phaseStart) / 0.6
        C = C0 * (1 - clamp(p))
        fade = 1 - clamp(p)
        particleFade = fade
        if (p >= 1.1 && !settled) {
          settled = true
          settledRef.current()
        }
      }

      // Bo's route: flower, page, flower, page. Lands above the page when the draft is ready.
      let target = waypoint
      if (activePhase === 'ready') {
        target = { x: page.x + page.w + 6, y: page.y + 6 }
      } else if (activePhase === 'running' && t >= stopUntil) {
        chooseStop()
        target = waypoint
      }
      // Pollen trickles off Bo while it flies, so there is always more on the way.
      if (activePhase === 'running' && aliveCount < particles.length * (0.2 + C * 1.1)) {
        carryIn(Math.max(1, Math.round(dt * 36)), bee, 50)
      }
      const wobble = activePhase === 'ready' ? 0 : 1
      const tx = target.x + Math.cos(t * 3.1) * 12 * wobble
      const ty = target.y + Math.sin(t * 4.3) * 8 * wobble
      if (reduce) {
        bee.x = page.x + page.w + 6
        bee.y = page.y + 6
      } else {
        bee.vx += (tx - bee.x) * 22 * dt
        bee.vy += (ty - bee.y) * 22 * dt
        const damp = Math.exp(-dt * 6.5)
        bee.vx *= damp
        bee.vy *= damp
        bee.x += bee.vx * dt
        bee.y += bee.vy * dt
      }
      const tilt = clamp(bee.vx * 0.04, -14, 14)
      beeEl.style.transform = `translate3d(${bee.x - BEE_W / 2}px, ${bee.y - BEE_W / 2}px, 0) rotate(${tilt}deg)`

      // The new design: blurred and faint while the swarm is unordered, sharp once it agrees.
      const blurPx = Math.round((1 - smooth(C)) * 22 * 2) / 2
      if (blurPx !== lastBlur) {
        lastBlur = blurPx
        ghost.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
      }
      ghost.style.opacity = String(smooth((C - 0.1) / 0.55) * fade)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Flowers: the user's notes. They recede as their pollen is carried off.
      ctx.fillStyle = '#ff8a7a'
      ctx.globalAlpha = (1 - 0.65 * C) * fade * 0.9
      for (const f of flowers) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4
          ctx.beginPath()
          ctx.arc(f.x + Math.cos(a) * 9, f.y + Math.sin(a) * 9, 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.fillStyle = AMBER
      for (const f of flowers) {
        ctx.beginPath()
        ctx.arc(f.x, f.y, 5.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // The unordered cloud follows Bo, then drifts toward the page as order arrives.
      const cx = lerp(bee.x, page.x + page.w / 2, smooth(C * 1.2))
      const cy = lerp(bee.y, page.y + page.h / 2, smooth(C * 1.2))
      const settledR = clamp(gap * 0.5, 1.5, 3.4)

      for (const p of particles) {
        if (!p.alive) continue
        const ci = smooth((C - p.delay) / 0.4)
        const chaos = 1 - ci

        if (reduce) {
          p.x = p.tx
          p.y = p.ty
        } else {
          const phase1 = t * (0.8 + p.seed * 0.9) + p.seed * 40
          const phase2 = t * (0.6 + p.seed * 0.7) + p.seed * 91
          // Half follows Bo, half roams its own patch of the screen, so the whole page is full.
          const hx = lerp(cx, p.fx * W, 0.5)
          const hy = lerp(cy, p.fy * H, 0.5)
          const k = 140 * ci * ci
          const d = 1.3 + 15 * ci
          const ax =
            (hx - p.x) * 0.9 * chaos + Math.cos(phase1) * 230 * chaos + (p.tx - p.x) * k - p.vx * d
          const ay =
            (hy - p.y) * 0.9 * chaos + Math.sin(phase2) * 230 * chaos + (p.ty - p.y) * k - p.vy * d
          p.vx += ax * dt
          p.vy += ay * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
        }

        // Entropy is soft, large and faint. Order is small, crisp and the colour of the design.
        const blur = Math.pow(chaos, 1.4)
        const r = settledR + blur * 9 * (0.6 + p.seed * 0.8)
        const strayFade = p.stray ? 1 - smooth((C - 0.7) / 0.3) : 1
        const amberAlpha = chaos * (0.8 / (1 + blur * 2.2)) * strayFade * fade
        const seatAlpha = p.stray ? 0 : ci * 0.95 * p.alpha * particleFade
        if (amberAlpha > 0.01) {
          ctx.globalAlpha = amberAlpha
          ctx.drawImage(amberSprite, p.x - r, p.y - r, r * 2, r * 2)
        }
        if (seatAlpha > 0.01) {
          ctx.globalAlpha = seatAlpha
          ctx.drawImage(spriteFor(p.color), p.x - r, p.y - r, r * 2, r * 2)
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      relayoutRef.current = () => {}
    }
  }, [])

  return (
    <div ref={hostRef} className="bee-field" aria-hidden="true">
      <div ref={ghostRef} className="bee-ghost">
        <DesignThumb design={design} />
      </div>
      <canvas ref={canvasRef} />
      <div ref={beeRef} className="bee-field-bee">
        <Bee mood={phase === 'ready' ? 'cheer' : phase === 'failed' ? 'think' : 'work'} />
      </div>
    </div>
  )
}
