import { z } from 'zod'
const text = z.string().max(20000)
const evidence = z.array(z.string().uuid()).max(40)
const base = { id: z.string().min(1).max(80), evidenceIds: evidence }
const availability = z.enum(['delivered', 'pilot', 'planned', 'unknown'])
export const blockSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...base,
      type: z.literal('paragraph'),
      text,
      marks: z
        .array(
          z
            .object({
              from: z.number().int().min(0).max(20000),
              to: z.number().int().min(0).max(20000),
              type: z.enum(['bold', 'italic', 'code', 'link']),
              href: z.string().max(2048).optional(),
            })
            .strict()
        )
        .max(1000)
        .optional(),
    })
    .strict(),
  z.object({ ...base, type: z.literal('list'), items: z.array(text).min(1).max(40) }).strict(),
  z
    .object({
      ...base,
      type: z.literal('capability_group'),
      heading: text,
      availability,
      items: z.array(text).min(1).max(40),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('metric_table'),
      rows: z
        .array(
          z
            .object({ label: text, value: text, unit: text, scope: text, methodology: text })
            .strict()
        )
        .min(1)
        .max(30),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('comparison_table'),
      columns: z.array(text).min(2).max(8),
      rows: z.array(z.array(text).min(2).max(8)).min(1).max(30),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('image'),
      sourceChunkId: z.string().uuid(),
      caption: text,
      alt: text,
      disposition: z.enum(['internal_only', 'public_approved']),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal('reference_link'),
      label: text,
      url: z
        .string()
        .url()
        .max(2048)
        .refine((v) => /^https?:\/\//.test(v)),
    })
    .strict(),
])
export const canonicalSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(255),
    description: z.string().min(1).max(1000),
    language: z.literal('en'),
    stage: z.enum(['concept', 'in_development', 'pilot', 'live', 'unknown']),
    outcomeStatus: z.enum(['measured', 'not_measured', 'not_applicable']),
    sections: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(/^[a-z][a-z0-9_]*$/)
              .max(80),
            blocks: z.array(blockSchema).max(80),
          })
          .strict()
      )
      .max(20),
  })
  .strict()
export type CanonicalContent = z.infer<typeof canonicalSchema>
export type SemanticBlock = z.infer<typeof blockSchema>
export type ValidationIssue = {
  code: string
  severity: 'blocking' | 'warning'
  message: string
  sectionKey?: string
  blockId?: string
  claimHash?: string
  evidenceHash?: string
}
export function blockText(block: SemanticBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'list':
      return block.items.join(' ')
    case 'capability_group':
      return [block.heading, block.availability, ...block.items].join(' ')
    case 'metric_table':
      return block.rows.map((r) => Object.values(r).join(' ')).join(' ')
    case 'comparison_table':
      return [...block.columns, ...block.rows.flat()].join(' ')
    case 'reference_link':
      return block.label
    case 'image':
      return ''
  }
}
export const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length
