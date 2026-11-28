import { z } from 'zod'
import { evidenceKind, EVIDENCE_KINDS } from '../copy_rules.ts'

/**
 * What the "Let AI choose" model calls return: a design system and a layout of frames for every page
 * (`design_canvas`), and the text of one designed page (`write_design_page`). The model never writes
 * canvas JSON: `normalize.ts` and `validate.ts` check and clamp the design, `compose.ts` builds the
 * canvas. Geometry is in canvas units (tenths of a millimetre; A4 is 2100 x 2970). Browser-safe.
 */

export const AI_TEMPLATE_ID = 'ai_design'
export const AI_TEMPLATE_VERSION = 1

export const PALETTE_ROLES = ['ink', 'paper', 'surface', 'primary', 'accent', 'muted'] as const
export type PaletteRole = (typeof PALETTE_ROLES)[number]

/** Families the design may use: names only. `sans` and `display` are the shipped Inter files. */
export const AI_FAMILIES = ['sans', 'display', 'brand'] as const
export type AiFamily = (typeof AI_FAMILIES)[number]

export const TEXT_ROLES = [
  'eyebrow',
  'title',
  'subtitle',
  'heading',
  'lead',
  'body',
  'quote',
  'stat',
  'label',
  'caption',
  'footer',
] as const
export type TextRole = (typeof TEXT_ROLES)[number]
export const OTHER_ROLES = ['image', 'panel', 'rule', 'decor'] as const
export const FRAME_ROLES = [...TEXT_ROLES, ...OTHER_ROLES] as const
export type FrameRole = (typeof FRAME_ROLES)[number]

export const FRAME_KINDS = ['text', 'image', 'shape', 'art'] as const

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
/** A palette role of the design system, or plain hex. */
export const colorRefSchema = z.union([z.enum(PALETTE_ROLES), hex])
export type ColorRef = z.infer<typeof colorRefSchema>

const text = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).nullish()
const num = (min: number, max: number) => z.number().min(min).max(max)

export const designSystemSchema = z.object({
  name: text(60),
  /** Hex colours for the six roles: from the brand kit, or from the colours of the materials. */
  palette: z.object({
    ink: hex,
    paper: hex,
    surface: hex,
    primary: hex,
    accent: hex,
    muted: hex,
  }),
  fonts: z.object({ heading: z.enum(AI_FAMILIES), body: z.enum(AI_FAMILIES) }),
  /** Type sizes in points for the scale steps the roles use. */
  scale: z.object({
    caption: num(7, 14),
    body: num(8, 16),
    lead: num(9, 24),
    heading: num(12, 48),
    title: num(20, 96),
  }),
  /** Margin, gutter in canvas units. */
  grid: z.object({
    margin: z.number().min(100).max(300),
    columns: z.number().int().min(2).max(12),
    gutter: z.number().min(20).max(200),
  }),
})
export type DesignSystem = z.infer<typeof designSystemSchema>

export const designStyleSchema = z
  .object({
    fill: colorRefSchema.nullish(),
    /** Fill transparency, 0 to 100. */
    fillAlpha: z.number().min(0).max(100).nullish(),
    color: colorRefSchema.nullish(),
    /** Exact size in points; the role's scale step when absent. */
    size: num(5, 200).nullish(),
    weight: z.union([z.literal(400), z.literal(600), z.literal(700), z.literal(800)]).nullish(),
    family: z.enum(AI_FAMILIES).nullish(),
    italic: z.boolean().nullish(),
    caps: z.boolean().nullish(),
    /** Percent of the type size. */
    lineHeight: num(90, 220).nullish(),
    /** Thousandths of an em. */
    tracking: num(-50, 300).nullish(),
    align: z.enum(['left', 'center', 'right']).nullish(),
    valign: z.enum(['top', 'middle', 'bottom']).nullish(),
    /** Tenths of a millimetre. */
    radius: num(0, 500).nullish(),
    padding: num(0, 400).nullish(),
    border: z
      .object({
        width: num(1, 50),
        color: colorRefSchema,
        style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
      })
      .nullish(),
  })
  .strip()
export type DesignStyle = z.infer<typeof designStyleSchema>

export const designFrameSchema = z.object({
  id: text(40),
  kind: z.enum(FRAME_KINDS),
  role: z.enum(FRAME_ROLES),
  x: num(-500, 2600),
  y: num(-500, 3500),
  w: num(1, 3000),
  h: num(1, 3500),
  style: designStyleSchema.nullish(),
  /** Text frames: what the frame says, in a sentence. */
  brief: optionalText(240),
  /** Image frames: a reference from the materials ("img2"), and what the picture should show. */
  imageRef: optionalText(20),
  subject: optionalText(200),
  fit: z.enum(['cover', 'contain']).nullish(),
  /** Shape frames. */
  shape: z.enum(['rect', 'ellipse', 'hex', 'line']).nullish(),
  /** Art frames. */
  art: z.enum(['ribbons', 'glow', 'hexagons']).nullish(),
})
export type DesignFrame = z.infer<typeof designFrameSchema>

export const designPageSchema = z.object({
  /** What the page is for: also what is retrieved for it. */
  purpose: text(300),
  /** Up to three questions the sources should answer for this page. */
  questions: z.array(text(200)).max(3).default([]),
  background: colorRefSchema.default('paper'),
  frames: z.array(designFrameSchema).min(1).max(60),
})
export type DesignPage = z.infer<typeof designPageSchema>

export const canvasDesignSchema = z.object({
  system: designSystemSchema,
  pages: z.array(designPageSchema).min(1).max(16),
  reviewer_notes: z.array(z.string().trim().max(300)).max(8).default([]),
})
export type CanvasDesign = z.infer<typeof canvasDesignSchema>

// -------------------------------------------------------------------- content

export const pageFrameTextSchema = z.object({
  id: text(40),
  /** Plain text; a new line starts a new paragraph. */
  text: z.string().trim().max(1600),
  /** Chunk ids that support the text; they become numbered footnotes. */
  chunks: z.array(z.string().min(1).max(200)).max(6).default([]),
})
export type PageFrameText = z.infer<typeof pageFrameTextSchema>

export const pageClaimSchema = z.object({
  claim: text(80),
  /** The frame the claim is in. */
  frame: text(40),
  kind: z
    .preprocess((v) => (typeof v === 'string' ? evidenceKind(v) : v), z.enum(EVIDENCE_KINDS))
    .default('measured'),
})
export type PageClaim = z.infer<typeof pageClaimSchema>

export const designPageContentSchema = z.object({
  frames: z.array(pageFrameTextSchema).max(60),
  claims: z.array(pageClaimSchema).max(4).default([]),
  /** One line saying what this page established, for later pages. */
  summary: z.string().trim().max(200).default(''),
  reviewer_notes: z.array(z.string().trim().max(300)).max(8).default([]),
})
export type DesignPageContent = z.infer<typeof designPageContentSchema>
