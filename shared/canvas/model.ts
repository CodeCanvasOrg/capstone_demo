import { z } from 'zod'
import { documentSchema, isAllowedLinkHref } from '../editor/schema.ts'

/**
 * The stored canvas: A4 sheets holding positioned frames. This is our own
 * format, not GrapesJS's. The editor converts to and from GrapesJS at the edge
 * (see grapes.ts), so validation, rendering and text derivation never depend on
 * an editor library, and an editor upgrade can never change stored data.
 *
 * Geometry is in integer tenths of a millimetre from the sheet's top-left
 * corner (x: 200 is 20.0 mm). Colours are brand references, so a brand update
 * restyles every canvas, or plain hex where the user picked one. Browser-safe.
 */
export const CANVAS_SCHEMA_VERSION = 1

/** A4 in tenths of a millimetre. */
export const SHEET = { w: 2100, h: 2970 } as const
export const LIMITS = {
  sheets: 24,
  framesPerSheet: 60,
  /** Smallest frame side: 2 mm. */
  minSide: 20,
  /** Serialised size the server accepts. */
  bytes: 2_000_000,
} as const

export const BRAND_COLORS = [
  'primary',
  'accent',
  'accentText',
  'text',
  'muted',
  'background',
  'surface',
  'white',
] as const
export type BrandColor = (typeof BRAND_COLORS)[number]

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const colorSchema = z.union([z.enum(BRAND_COLORS), hex])
export type CanvasColor = z.infer<typeof colorSchema>

/** Type sizes come from a fixed scale, so pages keep one typographic rhythm. */
export const FONT_SCALE = { xs: 7, sm: 8.5, md: 9.5, lg: 12, xl: 17, xxl: 26, display: 44 } as const
export type FontScale = keyof typeof FONT_SCALE

const tenths = (min: number, max: number) => z.number().int().min(min).max(max)

export const geoSchema = z
  .object({
    x: tenths(0, SHEET.w - LIMITS.minSide),
    y: tenths(0, SHEET.h - LIMITS.minSide),
    w: tenths(LIMITS.minSide, SHEET.w),
    h: tenths(LIMITS.minSide, SHEET.h),
  })
  .refine((g) => g.x + g.w <= SHEET.w && g.y + g.h <= SHEET.h, {
    message: 'Frame must stay inside its sheet',
  })
export type Geo = z.infer<typeof geoSchema>

export const styleSchema = z
  .object({
    fill: colorSchema.optional(),
    color: colorSchema.optional(),
    /** Corner radius, tenths of a mm. */
    radius: tenths(0, 500).optional(),
    /** Inner padding, tenths of a mm. */
    padding: tenths(0, 400).optional(),
    /** 0 to 100. */
    opacity: z.number().int().min(0).max(100).optional(),
    font: z.enum(Object.keys(FONT_SCALE) as [FontScale, ...FontScale[]]).optional(),
    weight: z.union([z.literal(400), z.literal(600), z.literal(800)]).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
  })
  .strip()
export type FrameStyle = z.infer<typeof styleSchema>

const tokenId = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Node = { type?: unknown; attrs?: Record<string, unknown>; marks?: Node[]; content?: Node[] }

/** Calls `visit` for every node and mark under `nodes`. */
export function walkNodes(nodes: readonly unknown[], visit: (node: Node) => void) {
  for (const raw of nodes) {
    const node = raw as Node
    visit(node)
    node.marks?.forEach(visit)
    if (Array.isArray(node.content)) walkNodes(node.content, visit)
  }
}

/** An image's address may only be the app's own route for that same document image. */
const imageSrcAllowed = (src: unknown, id: string) =>
  src === undefined ||
  src === null ||
  (typeof src === 'string' &&
    new RegExp(
      `^/workspaces/${UUID.source.slice(1, -1)}/documents/${UUID.source.slice(1, -1)}/images/${id}$`,
      'i'
    ).test(src))

/** What the schema check cannot see: link targets and where images come from. */
function unsafeContent(content: readonly unknown[]): string | null {
  let problem: string | null = null
  walkNodes(content, (node) => {
    if (problem) return
    if (node.type === 'link' && !isAllowedLinkHref(node.attrs?.href)) problem = 'Link not allowed'
    if (node.type === 'image') {
      const id = node.attrs?.documentImageId
      if (typeof id !== 'string' || !UUID.test(id)) problem = 'Images must be document images'
      else if (!imageSrcAllowed(node.attrs?.src, id)) problem = 'Image address not allowed'
    }
  })
  return problem
}

/** Tiptap blocks of a text frame, checked against the one document schema. */
const blocksSchema = z
  .array(z.record(z.string(), z.unknown()))
  .max(80)
  .superRefine((content, ctx) => {
    if (content.some((block) => block.type === 'horizontalRule'))
      ctx.addIssue({ code: 'custom', message: 'Page breaks belong between sheets, not in a frame' })
    const unsafe = unsafeContent(content)
    if (unsafe) ctx.addIssue({ code: 'custom', message: unsafe })
    try {
      documentSchema()
        .nodeFromJSON({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] })
        .check()
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: `Invalid text: ${(error as Error).message}` })
    }
  })
export type TipTapBlock = Record<string, unknown> & { type: string }

const base = {
  id: tokenId,
  geo: geoSchema,
  /** Stacking order on the sheet; higher is in front. */
  z: z.number().int().min(0).max(999),
  /** Reading order on the sheet, for the derived text and screen readers. */
  order: z.number().int().min(0).max(999),
  style: styleSchema.default({}),
  locked: z.boolean().optional(),
}

export const QUALIFIERS = ['measured', 'estimated', 'client_reported', 'design_target'] as const

export const frameSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('text'), doc: blocksSchema }).strip(),
  z
    .object({
      ...base,
      kind: z.literal('figure'),
      value: z.string().trim().min(1).max(12),
      label: z.string().trim().max(200),
      qualifier: z.enum(QUALIFIERS).optional(),
    })
    .strip(),
  z
    .object({
      ...base,
      kind: z.literal('image'),
      /** A registered document image; any other source is refused. */
      imageId: z.string().regex(UUID).nullable(),
      alt: z.string().trim().max(300),
      fit: z.enum(['cover', 'contain']).default('cover'),
    })
    .strip(),
  z
    .object({
      ...base,
      kind: z.literal('shape'),
      shape: z.enum(['rect', 'ellipse', 'hex', 'line']),
    })
    .strip(),
  /** Generated brand artwork; drawn by the renderer, never uploaded. */
  z.object({ ...base, kind: z.literal('art'), art: z.enum(['ribbons', 'glow']) }).strip(),
])
export type Frame = z.infer<typeof frameSchema>
export type FrameKind = Frame['kind']
export type TextFrame = Extract<Frame, { kind: 'text' }>

export const sheetSchema = z
  .object({
    id: tokenId,
    background: z.union([colorSchema, z.literal('gradient')]).default('white'),
    frames: z.array(frameSchema).max(LIMITS.framesPerSheet),
  })
  .strip()
export type Sheet = z.infer<typeof sheetSchema>

export const canvasSchema = z
  .object({
    schemaVersion: z.literal(CANVAS_SCHEMA_VERSION),
    sheets: z.array(sheetSchema).min(1).max(LIMITS.sheets),
  })
  .strip()
  .superRefine((canvas, ctx) => {
    const seen = new Set<string>()
    for (const sheet of canvas.sheets)
      for (const item of [sheet, ...sheet.frames]) {
        if (seen.has(item.id)) ctx.addIssue({ code: 'custom', message: `Duplicate id ${item.id}` })
        seen.add(item.id)
      }
  })
export type CanvasDocument = z.infer<typeof canvasSchema>

export type CanvasProblem = { path: string; message: string }

/**
 * The only way stored or submitted canvas data is read. Unknown keys are
 * dropped, unknown frame kinds and unsafe values are refused, and images must
 * belong to the document when the caller passes its image ids.
 */
export function parseCanvas(
  input: unknown,
  { imageIds }: { imageIds?: ReadonlySet<string> } = {}
): { ok: true; canvas: CanvasDocument } | { ok: false; problems: CanvasProblem[] } {
  if (JSON.stringify(input ?? null).length > LIMITS.bytes)
    return { ok: false, problems: [{ path: '', message: 'Canvas is too large' }] }
  const parsed = canvasSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  if (imageIds) {
    const problems: CanvasProblem[] = []
    parsed.data.sheets.forEach((sheet, s) =>
      sheet.frames.forEach((frame, f) => {
        const path = `sheets.${s}.frames.${f}`
        if (frame.kind === 'image' && frame.imageId && !imageIds.has(frame.imageId))
          problems.push({ path: `${path}.imageId`, message: 'Unknown image' })
        if (frame.kind === 'text')
          walkNodes(frame.doc, (node) => {
            const id = node.attrs?.documentImageId
            if (node.type === 'image' && typeof id === 'string' && !imageIds.has(id))
              problems.push({ path: `${path}.doc`, message: 'Unknown image' })
          })
      })
    )
    if (problems.length) return { ok: false, problems }
  }
  return { ok: true, canvas: parsed.data }
}
