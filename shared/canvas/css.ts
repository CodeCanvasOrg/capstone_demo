import type { BrandKit } from '../layout/brand.ts'
import { mm, toPx } from './geometry.ts'
import { FONT_SCALE, type CanvasColor, type FontFamily, type Frame, type Sheet } from './model.ts'

/** Safe font stacks; `brand` inherits the brand font set on the page. */
export const FONT_STACKS: Record<Exclude<FontFamily, 'brand'>, string> = {
  sans: 'Inter,"Helvetica Neue",Arial,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace',
}
const SHADOW_CSS = {
  sm: '0 0.3mm 0.8mm rgba(0,0,0,.12)',
  md: '0 1mm 3mm rgba(0,0,0,.14)',
  lg: '0 2.5mm 7mm rgba(0,0,0,.18)',
} as const

/**
 * How a frame looks, as CSS declarations. The editor canvas and the export
 * renderer both use this, so what is edited is what prints. Brand colours are
 * CSS variables (--cv-primary, ...) set once per document from the brand kit.
 * Browser-safe.
 */
export const color = (value: CanvasColor | undefined) =>
  value === undefined ? undefined : value.startsWith('#') ? value : `var(--cv-${value})`

export function brandVars(brand: Pick<BrandKit, 'palette'>): Record<string, string> {
  const p = brand.palette
  return {
    '--cv-primary': p.primary,
    '--cv-accent': p.accent,
    '--cv-accentText': p.accentText,
    '--cv-text': p.text,
    '--cv-muted': p.muted,
    '--cv-background': p.background,
    '--cv-surface': p.surface,
    '--cv-white': '#ffffff',
    '--cv-gradient': `radial-gradient(70% 95% at 100% 100%,color-mix(in srgb,${p.accent} 70%,transparent),transparent 62%),linear-gradient(155deg,${p.primary} 0%,color-mix(in srgb,${p.primary} 58%,#3d3d3d) 100%)`,
  }
}

export function sheetCss(sheet: Pick<Sheet, 'background'>): Record<string, string> {
  return sheet.background === 'gradient'
    ? { background: 'var(--cv-gradient)', color: '#fff' }
    : { background: color(sheet.background)! }
}

/** Position only; the editor writes these while dragging. */
export function geoCss(frame: Pick<Frame, 'geo' | 'z'>): Record<string, string> {
  return {
    'position': 'absolute',
    'left': mm(frame.geo.x),
    'top': mm(frame.geo.y),
    'width': mm(frame.geo.w),
    'height': mm(frame.geo.h),
    'z-index': String(frame.z),
  }
}

export function lookCss(frame: Frame): Record<string, string> {
  const s = frame.style
  const css: Record<string, string> = { 'box-sizing': 'border-box', 'overflow': 'hidden' }
  if (frame.kind === 'shape') {
    css.background = color(s.fill ?? 'primary')!
    if (frame.shape === 'ellipse') css['border-radius'] = '50%'
    if (frame.shape === 'hex')
      css['clip-path'] = 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)'
  } else if (s.fill) css.background = color(s.fill)!
  if (s.fill && s.fillAlpha !== undefined && s.fillAlpha < 100)
    css.background = `color-mix(in srgb,${color(s.fill)} ${s.fillAlpha}%,transparent)`
  if (s.color) css.color = color(s.color)!
  if (s.radius !== undefined && (frame.kind !== 'shape' || frame.shape === 'rect'))
    css['border-radius'] = mm(s.radius)
  if (s.padding !== undefined) css.padding = mm(s.padding)
  if (s.opacity !== undefined) css.opacity = String(s.opacity / 100)
  if (s.font) css['font-size'] = `${FONT_SCALE[s.font]}pt`
  if (s.size) css['font-size'] = `${s.size}pt`
  if (s.family && s.family !== 'brand') css['font-family'] = FONT_STACKS[s.family]
  if (s.weight) css['font-weight'] = String(s.weight)
  if (s.italic) css['font-style'] = 'italic'
  if (s.caps) css['text-transform'] = 'uppercase'
  if (s.lineHeight) css['line-height'] = String(s.lineHeight / 100)
  if (s.tracking) css['letter-spacing'] = `${s.tracking / 1000}em`
  if (s.align) css['text-align'] = s.align
  if (s.border) css.border = `${mm(s.border.width)} ${s.border.style} ${color(s.border.color)}`
  if (s.shadow) css['box-shadow'] = SHADOW_CSS[s.shadow]
  if (s.valign && s.valign !== 'top') {
    css.display = 'flex'
    css['flex-direction'] = 'column'
    css['justify-content'] = s.valign === 'middle' ? 'center' : 'flex-end'
  }
  if (frame.kind === 'figure') {
    css['line-height'] ??= '1'
    css['font-size'] ??= `${FONT_SCALE.display}pt`
    css['font-weight'] ??= '800'
  }
  return css
}

/**
 * Position in CSS pixels, for the live editor: GrapesJS's absolute dragger reads
 * `left`/`top` as plain numbers and would misread millimetres. Stored data and
 * exports stay in millimetres.
 */
export function geoCssPx(frame: Pick<Frame, 'geo' | 'z'>): Record<string, string> {
  const px = (tenths: number) => `${Number(toPx(tenths).toFixed(3))}px`
  return {
    ...geoCss(frame),
    left: px(frame.geo.x),
    top: px(frame.geo.y),
    width: px(frame.geo.w),
    height: px(frame.geo.h),
  }
}

export type CssUnits = 'mm' | 'px'

export const frameCss = (frame: Frame, units: CssUnits = 'mm') => ({
  ...(units === 'px' ? geoCssPx(frame) : geoCss(frame)),
  ...lookCss(frame),
})

export const declarations = (css: Record<string, string>) =>
  Object.entries(css)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')

/**
 * How the picture sits in an image frame: cropped to fill (`cover`, around its
 * focal point) or whole (`contain`). Inline style for the <img>; editor and
 * export both use it. Values come from enums and bounded integers only.
 */
export function imageCss(frame: Extract<Frame, { kind: 'image' }>): string {
  const focus = frame.focus ?? { x: 50, y: 50 }
  return `object-fit:${frame.fit};object-position:${focus.x}% ${focus.y}%`
}

/** Base styles for sheets and frame content, shared by the editor canvas and exports. */
export const CANVAS_BASE_CSS = `
.cv-sheet{position:relative;width:210mm;height:297mm;overflow:hidden;box-sizing:border-box}
.cv-frame{line-height:1.45}
.cv-frame>:first-child{margin-top:0}
.cv-frame>:last-child{margin-bottom:0}
.cv-frame h1,.cv-frame h2,.cv-frame h3,.cv-frame h4{margin:0 0 .35em;line-height:1.15;letter-spacing:-.01em}
.cv-frame h1{font-size:2em}.cv-frame h2{font-size:1.5em}.cv-frame h3{font-size:1.15em}.cv-frame h4{font-size:1em}
.cv-frame p{margin:0 0 .6em}
.cv-frame ul,.cv-frame ol{margin:.3em 0 .6em;padding-left:1.1em}
.cv-frame li{margin:0 0 .25em}
.cv-frame li>p{margin:0}
.cv-frame a{color:inherit}
.cv-frame img{max-width:100%;height:auto;display:block}
.cv-figure .cv-figure-label{display:block;margin-top:.25em;font-size:9.5pt;font-weight:400;line-height:1.35}
.cv-image img{width:100%;height:100%;display:block}
.cv-art svg{width:100%;height:100%;display:block}
.cv-art-glow{background:radial-gradient(55% 45% at 78% 30%,color-mix(in srgb,var(--cv-accent) 28%,transparent),transparent 70%)}
`
