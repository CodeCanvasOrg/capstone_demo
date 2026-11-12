import { z } from 'zod'

/**
 * Publication content contract v1. Lives under `content.attrs.publication` of
 * the saved TipTap document and is separate from the historical canonical
 * template schema in `shared/templates/content.ts`. Browser-safe: no database
 * or server imports.
 */
export const PUBLICATION_SCHEMA_VERSION = 1
export const PUBLICATION_FIELD_PREFIX = 'content.attrs.publication'

export const RESERVED_DOC_TYPES = ['case_study', 'product', 'research', 'news'] as const
export const ENABLED_DOC_TYPES = ['case_study'] as const
export const QUALIFIERS = ['measured', 'estimated', 'client_reported', 'design_target'] as const
export const SECTION_TYPES = [
  'narrative',
  'challenge',
  'solution',
  'capabilities',
  'results',
  'limitations',
] as const
export const UNRESOLVED_REASONS = [
  'node_removed',
  'range_out_of_bounds',
  'text_changed',
  'unknown_qualifier',
] as const

export const LIMITS = {
  sections: 50,
  nodeIdsPerSection: 500,
  claims: 500,
  results: 200,
  figures: 100,
  notes: 200,
  references: 500,
  evidencePerClaim: 50,
  context: 500,
  methodology: 1000,
  message: 2000,
} as const

const id = z.guid()
const nodeRef = z.strictObject({ nodeId: id })
const textRef = z.strictObject({
  nodeId: id,
  from: z.number().int().min(0),
  to: z.number().int().min(1),
  textHash: z.string().regex(/^[0-9a-f]{64}$/),
})
const context = z.string().min(1).max(LIMITS.context)

const claim = z.strictObject({
  id,
  state: z.literal('active'),
  text: textRef,
  authorship: z.enum(['ai', 'user', 'unknown']),
  evidenceRefIds: z.array(id).max(LIMITS.evidencePerClaim),
})
const result = z.strictObject({
  id,
  state: z.literal('active'),
  claimId: id,
  value: textRef,
  qualifier: z.enum(QUALIFIERS),
  comparison: z.enum(['exact', 'up_to', 'at_least', 'range']).optional(),
  units: context.optional(),
  scope: context.optional(),
  baseline: context.optional(),
  period: context.optional(),
  methodology: z.string().min(1).max(LIMITS.methodology).optional(),
})
// Stale anchors stay in the envelope for repair; they never render as active data.
const unresolved = z.strictObject({
  id,
  state: z.literal('needs_review'),
  reason: z.enum(UNRESOLVED_REASONS),
  nodeId: id.optional(),
})

export const publicationSchema = z.strictObject({
  schemaVersion: z.literal(PUBLICATION_SCHEMA_VERSION),
  docType: z.enum(RESERVED_DOC_TYPES),
  hero: z.strictObject({ title: nodeRef, summary: nodeRef.optional() }),
  sections: z
    .array(
      z.strictObject({
        id,
        type: z.enum(SECTION_TYPES),
        heading: nodeRef.optional(),
        nodeIds: z.array(id).max(LIMITS.nodeIdsPerSection),
      })
    )
    .max(LIMITS.sections),
  claims: z
    .array(z.discriminatedUnion('state', [claim, unresolved]))
    .max(LIMITS.claims)
    .optional(),
  results: z
    .array(z.discriminatedUnion('state', [result, unresolved.extend({ claimId: id.optional() })]))
    .max(LIMITS.results)
    .optional(),
  figures: z
    .array(
      z.strictObject({
        id,
        image: nodeRef,
        asset: z.strictObject({
          kind: z.enum(['source_chunk', 'document_image']),
          id: z.string().min(1).max(100),
        }),
        caption: nodeRef.optional(),
      })
    )
    .max(LIMITS.figures)
    .optional(),
  reviewerNotes: z
    .array(
      z.strictObject({
        id,
        nodeId: id.optional(),
        message: z.string().min(1).max(LIMITS.message),
      })
    )
    .max(LIMITS.notes)
    .optional(),
  references: z
    .array(z.strictObject({ id, chunkId: z.string().min(1).max(100) }))
    .max(LIMITS.references)
    .optional(),
})

export type PublicationMetadataV1 = z.infer<typeof publicationSchema>
export type DocType = (typeof RESERVED_DOC_TYPES)[number]
export type Qualifier = (typeof QUALIFIERS)[number]
export type TextRef = z.infer<typeof textRef>
export type FieldError = { field: string; message: string }

/** Document root `attrs.publication` is the only place the metadata lives. */
export type PublicationNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: unknown[]
  content?: PublicationNode[]
}
export type PublicationDocument = {
  type: 'doc'
  attrs?: Record<string, unknown>
  content: PublicationNode[]
}

/** Blocks that carry a stable `attrs.nodeId`. */
export const IDENTIFIED_BLOCKS = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'image',
  'horizontalRule',
])
export const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])

/**
 * Text of one textblock: text runs plus `\n` for hard breaks; atom citations
 * are excluded. Offsets in `TextRef` are UTF-16 indexes into this string.
 */
export function flattenText(node: PublicationNode): string {
  let out = ''
  for (const child of node.content ?? []) {
    if (child.type === 'text') out += child.text ?? ''
    else if (child.type === 'hardBreak') out += '\n'
  }
  return out
}

const MESSAGES: Record<string, string> = {
  invalid_enum_value: 'Choose one of the supported values.',
  invalid_value: 'Choose one of the supported values.',
  unrecognized_keys: 'This field is not supported.',
  invalid_type: 'This field has the wrong type or is missing.',
  too_big: 'This value is too long or has too many items.',
  too_small: 'This value is too short or has too few items.',
  invalid_format: 'This value has an invalid format.',
}

/** Adapts Zod issues to safe `{field,message}` pairs; never echoes input values. */
export function toFieldErrors(error: z.ZodError, max = 20): FieldError[] {
  return error.issues.slice(0, max).map((issue) => {
    const path = issue.path.map(String)
    if (issue.code === 'invalid_value' && path.at(-1) === 'qualifier')
      return {
        field: [PUBLICATION_FIELD_PREFIX, ...path].join('.'),
        message: 'Choose measured, estimated, client_reported or design_target.',
      }
    return {
      field: [PUBLICATION_FIELD_PREFIX, ...path].join('.'),
      message: MESSAGES[issue.code] ?? 'This field is not valid.',
    }
  })
}

const SEGMENT_LABELS: Record<string, string> = {
  hero: 'Hero',
  sections: 'Section',
  claims: 'Claim',
  results: 'Result',
  figures: 'Figure',
  references: 'Source',
  reviewerNotes: 'Reviewer note',
  title: 'title',
  summary: 'summary',
  heading: 'heading',
  nodeIds: 'blocks',
  nodeId: 'link',
  qualifier: 'qualifier',
  value: 'value',
  text: 'text',
  asset: 'image',
  caption: 'caption',
  chunkId: 'source',
  evidenceRefIds: 'evidence',
  claimId: 'claim link',
  docType: 'Document type',
  schemaVersion: 'Schema version',
}

/** Reader-facing name for a `content.attrs.publication.…` field path. */
export function describeField(field: string): string {
  if (!field.startsWith(`${PUBLICATION_FIELD_PREFIX}.`)) return 'Document content'
  const parts = field.slice(PUBLICATION_FIELD_PREFIX.length + 1).split('.')
  const words: string[] = []
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (/^\d+$/.test(part)) continue
    const label = SEGMENT_LABELS[part] ?? part
    words.push(
      /^\d+$/.test(parts[index + 1] ?? '') ? `${label} ${Number(parts[index + 1]) + 1}` : label
    )
  }
  return words.join(' · ') || 'Publication details'
}

/**
 * Finds the editor block an error points at by walking the metadata along the
 * field path. Returns null when the path names no block (e.g. duplicate IDs).
 */
export function nodeIdForField(publication: unknown, field: string): string | null {
  if (!field.startsWith(`${PUBLICATION_FIELD_PREFIX}.`)) return null
  const parts = field.slice(PUBLICATION_FIELD_PREFIX.length + 1).split('.')
  let current: unknown = publication
  let item: Record<string, unknown> | null = null
  let found: string | null = null
  parts.forEach((part, index) => {
    if (current === null || typeof current !== 'object') return
    current = (current as Record<string, unknown>)[part]
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      item = current as Record<string, unknown>
      if (typeof item.nodeId === 'string') found = item.nodeId
    }
    // A string at a nodeId/nodeIds position is the block ID itself.
    const key = /^\d+$/.test(part) ? parts[index - 1] : part
    if (typeof current === 'string' && (key === 'nodeId' || key === 'nodeIds')) found = current
  })
  // Claims, results and figures point at their anchor even when the path stops on a link.
  if (!found && item) {
    const record: Record<string, unknown> = item
    for (const key of ['image', 'text', 'value', 'title']) {
      const ref = record[key]
      if (
        ref &&
        typeof ref === 'object' &&
        typeof (ref as { nodeId?: unknown }).nodeId === 'string'
      )
        return (ref as { nodeId: string }).nodeId
    }
  }
  return found
}
