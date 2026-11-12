import { z } from 'zod'

/**
 * Publication content contract v1 (OUT-02). Semantic annotations live under
 * `content.attrs.publication` inside the one editable TipTap document; block
 * identity is `attrs.nodeId`. Browser-safe: no database or Node imports.
 * Separate from the historical `shared/templates/content.ts` v1.
 */
export const PUBLICATION_SCHEMA_VERSION = 1
export const RESERVED_DOC_TYPES = ['case_study', 'product', 'research', 'news'] as const
export const ENABLED_DOC_TYPES: readonly string[] = ['case_study']
export const QUALIFIERS = ['measured', 'estimated', 'client_reported', 'design_target'] as const
export const SECTION_TYPES = [
  'narrative',
  'challenge',
  'solution',
  'capabilities',
  'results',
  'limitations',
] as const
export const REVIEW_REASONS = [
  'text_changed',
  'node_removed',
  'range_out_of_bounds',
  'claim_needs_review',
  'qualifier_unknown',
] as const

export const LIMITS = {
  claims: 500,
  results: 200,
  sections: 50,
  sectionNodes: 2000,
  figures: 100,
  notes: 200,
  references: 500,
  noteLength: 2000,
  contextLength: 500,
} as const

const id = z.string().uuid()
const nodeRef = z.object({ nodeId: id }).strict()
const textRef = z
  .object({
    nodeId: id,
    // UTF-16 offsets into the flattened text of one textblock.
    from: z.number().int().min(0),
    to: z.number().int().min(1),
    textHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .refine((ref) => ref.to > ref.from, { message: 'Range must not be empty', path: ['to'] })
const context = z.string().min(1).max(LIMITS.contextLength)
const authorship = z.enum(['ai', 'user', 'unknown'])

// Active and unresolved records are distinct shapes, so stale data cannot be
// accepted accidentally as renderable data.
const claim = z.discriminatedUnion('state', [
  z
    .object({
      id,
      state: z.literal('active'),
      text: textRef,
      authorship,
      evidenceRefIds: z.array(id).max(50),
    })
    .strict(),
  z
    .object({
      id,
      state: z.literal('needs_review'),
      reason: z.enum(REVIEW_REASONS),
      text: textRef,
      authorship,
      evidenceRefIds: z.array(id).max(50),
    })
    .strict(),
])

const resultContext = {
  comparison: z.enum(['exact', 'up_to', 'at_least', 'range']).optional(),
  units: context.optional(),
  scope: context.optional(),
  baseline: context.optional(),
  period: context.optional(),
  methodology: context.optional(),
}
const result = z.discriminatedUnion('state', [
  z
    .object({
      id,
      state: z.literal('active'),
      claimId: id,
      value: textRef,
      qualifier: z.enum(QUALIFIERS),
      ...resultContext,
    })
    .strict(),
  z
    .object({
      id,
      state: z.literal('needs_review'),
      reason: z.enum(REVIEW_REASONS),
      claimId: id,
      value: textRef,
      // An unknown qualifier is never a fifth label; it waits for a person.
      qualifier: z.string().max(40).optional(),
      ...resultContext,
    })
    .strict(),
])

export const publicationMetadataSchema = z
  .object({
    schemaVersion: z.literal(PUBLICATION_SCHEMA_VERSION),
    docType: z.enum(RESERVED_DOC_TYPES),
    hero: z.object({ title: nodeRef, summary: nodeRef.optional() }).strict(),
    sections: z
      .array(
        z
          .object({
            id,
            type: z.enum(SECTION_TYPES),
            heading: nodeRef.optional(),
            nodeIds: z.array(id).max(LIMITS.sectionNodes),
          })
          .strict()
      )
      .max(LIMITS.sections),
    claims: z.array(claim).max(LIMITS.claims).optional(),
    results: z.array(result).max(LIMITS.results).optional(),
    figures: z
      .array(
        z
          .object({
            id,
            image: nodeRef,
            // A supplied URL is never an asset identity; resolution is by registry id.
            asset: z
              .object({
                kind: z.enum(['source_chunk', 'document_image']),
                id: z.string().min(1).max(128),
              })
              .strict(),
            caption: nodeRef.optional(),
          })
          .strict()
      )
      .max(LIMITS.figures)
      .optional(),
    reviewerNotes: z
      .array(
        z
          .object({
            id,
            nodeId: id.optional(),
            message: z.string().min(1).max(LIMITS.noteLength),
          })
          .strict()
      )
      .max(LIMITS.notes)
      .optional(),
    references: z
      .array(z.object({ id, chunkId: z.string().min(1).max(128) }).strict())
      .max(LIMITS.references)
      .optional(),
  })
  .strict()

export type PublicationMetadata = z.infer<typeof publicationMetadataSchema>
export type TextRef = z.infer<typeof textRef>
export type ReviewReason = (typeof REVIEW_REASONS)[number]
export type Qualifier = (typeof QUALIFIERS)[number]
export type FieldError = { field: string; message: string }

/** Zod issues to the established `{field,message}` envelope, rooted at the document. */
export function zodFieldErrors(
  error: z.ZodError,
  root = 'content.attrs.publication'
): FieldError[] {
  return error.issues.map((issue) => ({
    field: [root, ...issue.path].join('.'),
    message:
      issue.code === 'unrecognized_keys'
        ? `Unknown field: ${issue.keys.join(', ')}`
        : issue.path.at(-1) === 'qualifier'
          ? `Choose ${QUALIFIERS.join(', ')}.`
          : issue.message,
  }))
}

type FlatNode = { type: string; text?: string; content?: FlatNode[] }

/**
 * Flattened text of one textblock: text plus a newline per hard break; atom
 * citations contribute nothing. Offsets are UTF-16 code units, as in JavaScript.
 */
export function flattenText(node: FlatNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'sourceCitation') return ''
  return (node.content ?? []).map(flattenText).join('')
}
