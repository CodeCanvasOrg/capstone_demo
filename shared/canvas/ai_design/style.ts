import { charsPerLine, wrap } from '../portfolio/measure.ts'
import { PT, type TypeSpec } from '../portfolio/tokens.ts'
import {
  TEXT_ROLES,
  type AiFamily,
  type ColorRef,
  type DesignFrame,
  type DesignStyle,
  type DesignSystem,
  type FrameRole,
  type TextRole,
} from './schema.ts'

/**
 * A text frame's effective style: the design system's defaults for its role, overridden by the
 * frame's own style. Also the measurement: how many lines of a text a frame holds. Browser-safe.
 */

/** Canvas units per point. */
export const UNITS_PER_PT = PT
/** The canvas CSS gap between paragraphs, in em. */
export const PARAGRAPH_GAP = 0.6
/** How much wider than Inter the brand font is assumed to be: a conservative estimate. */
export const BRAND_WIDTH_FACTOR = 1.1

export const isTextRole = (role: FrameRole): role is TextRole =>
  (TEXT_ROLES as readonly string[]).includes(role)

/** Smallest legible size of a role in points: running text 8, small print 7. */
export const MIN_SIZE: Record<TextRole, number> = {
  eyebrow: 7,
  title: 8,
  subtitle: 8,
  heading: 8,
  lead: 8,
  body: 8,
  quote: 8,
  stat: 8,
  label: 7,
  caption: 7,
  footer: 7,
}
export const MAX_SIZE = 120

const STEP: Record<TextRole, keyof DesignSystem['scale']> = {
  eyebrow: 'caption',
  title: 'title',
  subtitle: 'lead',
  heading: 'heading',
  lead: 'lead',
  body: 'body',
  quote: 'lead',
  stat: 'title',
  label: 'caption',
  caption: 'caption',
  footer: 'caption',
}
const HEADING_ROLES = new Set<TextRole>(['title', 'heading', 'stat'])
const BOLD_ROLES = new Set<TextRole>(['title', 'heading', 'stat', 'eyebrow', 'label'])
const LINE: Record<TextRole, number> = {
  eyebrow: 130,
  title: 108,
  subtitle: 135,
  heading: 115,
  lead: 140,
  body: 145,
  quote: 140,
  stat: 100,
  label: 130,
  caption: 135,
  footer: 130,
}

export type ResolvedText = {
  size: number
  weight: 400 | 600 | 700 | 800
  family: AiFamily
  lineHeight: number
  tracking: number
  caps: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  color: ColorRef
  fill?: ColorRef
  fillAlpha: number
  padding: number
  radius: number
  border?: NonNullable<DesignStyle['border']>
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function resolveText(frame: Pick<DesignFrame, 'role' | 'style'>, system: DesignSystem) {
  const role: TextRole = isTextRole(frame.role) ? frame.role : 'body'
  const s = frame.style ?? {}
  const family: AiFamily =
    s.family ?? (HEADING_ROLES.has(role) ? system.fonts.heading : system.fonts.body)
  let weight = s.weight ?? (BOLD_ROLES.has(role) ? 700 : 400)
  // The shipped files: Inter Display has the one bold; Inter 400, 600 and 700.
  if (family === 'display') weight = 700
  else if (family === 'sans' && weight === 800) weight = 700
  const resolved: ResolvedText = {
    size: round1(s.size ?? system.scale[STEP[role]]),
    weight,
    family,
    lineHeight: round1(s.lineHeight ?? LINE[role]),
    tracking: Math.round(s.tracking ?? 0),
    caps: s.caps ?? role === 'eyebrow',
    italic: s.italic ?? false,
    align: s.align ?? 'left',
    valign: s.valign ?? 'top',
    color: s.color ?? 'ink',
    fill: s.fill ?? undefined,
    fillAlpha: Math.round(s.fillAlpha ?? 100),
    padding: Math.round(s.padding ?? 0),
    radius: Math.round(s.radius ?? 0),
    border: s.border ?? undefined,
  }
  return resolved
}

/** The measurement spec of a resolved style, and how much wider the font is than the metrics. */
export function measureSpec(r: ResolvedText): { spec: TypeSpec; factor: number } {
  return {
    spec: {
      size: r.size,
      line: (r.size * r.lineHeight) / 100,
      weight: r.weight === 800 ? 700 : r.weight,
      tracking: (r.tracking / 1000) * r.size,
      color: 'navy',
      display: r.family === 'display',
      caps: r.caps,
    },
    factor: r.family === 'brand' ? BRAND_WIDTH_FACTOR : 1,
  }
}

type Box = { w: number; h: number }

/** Points inside a frame's padding. */
export const innerSize = (geo: Box, r: Pick<ResolvedText, 'padding'>) => ({
  w: (geo.w - 2 * r.padding) / UNITS_PER_PT,
  h: (geo.h - 2 * r.padding) / UNITS_PER_PT,
})

export const paragraphs = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

/** Lines a text takes in a frame and the height in points they need, paragraph gaps included. */
export function measureText(text: string, geo: Box, r: ResolvedText) {
  const { spec, factor } = measureSpec(r)
  const width = innerSize(geo, r).w / factor
  const parts = paragraphs(text)
  const lines = parts.reduce((n, p) => n + wrap(p, width, spec).length, 0)
  const gaps = Math.max(parts.length - 1, 0)
  return {
    lines,
    height: lines * spec.line + gaps * PARAGRAPH_GAP * r.size,
  }
}

/** Whether a text fits the height of its frame (half a point of slack, as rounding). */
export const fitsFrame = (text: string, geo: Box, r: ResolvedText) =>
  measureText(text, geo, r).height <= innerSize(geo, r).h + 0.5

/** Rough characters the frame holds: for the writer's length target. */
export function charBudget(geo: Box, r: ResolvedText) {
  const { spec, factor } = measureSpec(r)
  const inner = innerSize(geo, r)
  const lines = Math.max(Math.floor(inner.h / spec.line + 1e-6), 1)
  const perLine = Math.max(charsPerLine(inner.w / factor, spec), 4)
  return { lines, charsPerLine: perLine, chars: lines * perLine }
}
