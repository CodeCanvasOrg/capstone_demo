import type { BrandKit } from '../layout/brand.ts'
import { mm } from './geometry.ts'
import { FONT_SCALE, type CanvasColor, type Frame, type Sheet } from './model.ts'

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
    '--cv-gradient': `radial-gradient(70% 95% at 100% 100%,color-mix(in srgb,${p.accent} 70%,transparent),transparent 62%),linear-gradient(155deg,${p.primary} 0%,color-mix(in srgb,${p.primary} 58%,#2f5fb0) 100%)`,
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
  if (s.color) css.color = color(s.color)!
  if (s.radius !== undefined && (frame.kind !== 'shape' || frame.shape === 'rect'))
    css['border-radius'] = mm(s.radius)
  if (s.padding !== undefined) css.padding = mm(s.padding)
  if (s.opacity !== undefined) css.opacity = String(s.opacity / 100)
  if (s.font) css['font-size'] = `${FONT_SCALE[s.font]}pt`
  if (s.weight) css['font-weight'] = String(s.weight)
  if (s.align) css['text-align'] = s.align
  if (s.valign && s.valign !== 'top') {
    css.display = 'flex'
    css['flex-direction'] = 'column'
    css['justify-content'] = s.valign === 'middle' ? 'center' : 'flex-end'
  }
  if (frame.kind === 'figure') {
    css['line-height'] = '1'
    css['font-size'] ??= `${FONT_SCALE.display}pt`
    css['font-weight'] ??= '800'
  }
  return css
}

export const frameCss = (frame: Frame) => ({ ...geoCss(frame), ...lookCss(frame) })

export const declarations = (css: Record<string, string>) =>
  Object.entries(css)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')

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
