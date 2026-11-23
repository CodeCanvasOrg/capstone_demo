import { z } from 'zod'

/**
 * What the author chooses in "Generate pages". Kept apart from the designs and the
 * canvas model so the layout options validator can read it without loading the
 * editor schema. Browser-safe.
 */
export const DEPTHS = ['concise', 'standard', 'detailed'] as const
export type Depth = (typeof DEPTHS)[number]
export const PROFILES = ['academic', 'informative'] as const
export type Profile = (typeof PROFILES)[number]
export const TEMPLATE_SETS = ['academic_report', 'research_brief', 'brochure'] as const
export type TemplateSet = (typeof TEMPLATE_SETS)[number]

export const canvasOptionsSchema = z.object({
  profile: z.enum(PROFILES).default('academic'),
  depth: z.enum(DEPTHS).default('standard'),
  templateSet: z.enum(TEMPLATE_SETS).default('academic_report'),
  /** `auto` lets the planner decide; a number is the exact page count, 3 to 16. */
  pages: z.union([z.literal('auto'), z.number().int().min(3).max(16)]).default('auto'),
  images: z.boolean().default(true),
})
export type CanvasOptions = z.infer<typeof canvasOptionsSchema>
