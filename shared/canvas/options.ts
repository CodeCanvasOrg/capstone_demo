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
/**
 * `portfolio` is the fixed template the canvas offers; `ai_design` ("Let AI choose") has the model
 * design the pages. The other values are the retired sets: they are still read (stored layout
 * options, old requests) and always mean `portfolio`.
 */
export const TEMPLATE_SETS = [
  'portfolio',
  'ai_design',
  'academic_report',
  'research_brief',
  'brochure',
] as const
export type TemplateSet = (typeof TEMPLATE_SETS)[number]

export const canvasOptionsSchema = z.object({
  profile: z.enum(PROFILES).default('informative'),
  depth: z.enum(DEPTHS).default('standard'),
  templateSet: z
    .enum(TEMPLATE_SETS)
    .default('portfolio')
    .transform((value): TemplateSet => (value === 'ai_design' ? 'ai_design' : 'portfolio')),
  /** Entries of the portfolio: `auto` lets the planner decide; a number is exact, 1 to 6. */
  entries: z.union([z.literal('auto'), z.number().int().min(1).max(6)]).default('auto'),
  /** `auto` lets the planner decide; a number is the exact page count, 3 to 16. */
  pages: z.union([z.literal('auto'), z.number().int().min(3).max(16)]).default('auto'),
  images: z.boolean().default(true),
})
export type CanvasOptions = z.infer<typeof canvasOptionsSchema>

/** Evidence tokens each page may read, set by depth. */
export const DEPTH_TOKENS: Record<Depth, number> = { concise: 2000, standard: 3500, detailed: 5000 }
