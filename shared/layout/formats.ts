/**
 * Entry formats. Each company template is generated as structured fields and
 * rendered with its own design in the brand colours. The format is stored in
 * the publication metadata, so the editor, the preview and the PDF all read
 * the same value. Browser-safe: no server imports.
 */
export const ENTRY_FORMATS = ['case_study', 'portfolio', 'technical', 'vision'] as const
export type EntryFormat = (typeof ENTRY_FORMATS)[number]

export const isFormat = (value: unknown): value is EntryFormat =>
  (ENTRY_FORMATS as readonly unknown[]).includes(value)

export type SectionRoleName =
  'results' | 'challenge' | 'solution' | 'steps' | 'capabilities' | 'roadmap'

/** The label above the headline, after the wordmark. */
export const FORMAT_KICKER: Record<EntryFormat, string> = {
  case_study: 'CASE STUDY',
  portfolio: 'PORTFOLIO',
  technical: 'TECHNICAL',
  vision: 'PRODUCT VISION',
}

/**
 * The heading written for each section. Roles are read back from these
 * headings, so an author who edits a heading's wording keeps the layout as long
 * as it still matches `ROLE_PATTERNS`.
 */
export const FORMAT_HEADINGS: Record<EntryFormat, Record<SectionRoleName, string>> = {
  case_study: {
    results: 'Key results',
    challenge: 'The challenge',
    solution: 'The solution',
    steps: 'How it works',
    capabilities: 'Key capabilities',
    roadmap: 'Roadmap',
  },
  portfolio: {
    results: 'Impact',
    challenge: 'The challenge',
    solution: 'The solution',
    steps: 'How it works',
    capabilities: 'What we built',
    roadmap: 'Next steps',
  },
  technical: {
    results: 'Evaluation',
    challenge: 'The problem',
    solution: 'The approach',
    steps: 'Architecture',
    capabilities: 'Implementation',
    roadmap: 'Limitations',
  },
  vision: {
    results: 'Impact',
    challenge: 'User need',
    solution: 'Product vision',
    steps: 'The experience',
    capabilities: 'Capabilities',
    roadmap: 'Roadmap',
  },
}

export const ROLE_PATTERNS: Record<SectionRoleName, RegExp> = {
  results: /^(?:key )?(?:results|impact|evaluation)\b/i,
  challenge: /^(?:the )?(?:challenge|problem|user need)\b/i,
  solution: /^(?:the )?(?:solution|approach|product vision|vision)\b/i,
  steps: /^(?:how it works|steps|process|architecture|the experience)\b/i,
  capabilities: /^(?:key )?(?:capabilities|implementation|what we built)\b/i,
  roadmap: /^(?:roadmap|next steps|limitations)\b/i,
}

export const roleOfHeading = (heading: string): SectionRoleName | null =>
  (Object.entries(ROLE_PATTERNS).find(([, pattern]) => pattern.test(heading.trim()))?.[0] as
    SectionRoleName | undefined) ?? null

/** Where each format puts its sections, top to bottom. Results stay under the hero except in the technical format. */
export const FORMAT_ORDER: Record<EntryFormat, SectionRoleName[]> = {
  case_study: ['results', 'challenge', 'solution', 'steps', 'capabilities', 'roadmap'],
  portfolio: ['results', 'challenge', 'solution', 'capabilities', 'steps', 'roadmap'],
  technical: ['challenge', 'solution', 'steps', 'capabilities', 'results', 'roadmap'],
  vision: ['challenge', 'solution', 'steps', 'capabilities', 'roadmap'],
}

export const CAPABILITY_STATUSES = ['delivered', 'pilot', 'planned'] as const
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number]
export const STATUS_LABEL: Record<CapabilityStatus, string> = {
  delivered: 'Delivered',
  pilot: 'Pilot',
  planned: 'Planned',
}
/** A capability line starts with its availability in brackets: "[Pilot] Title — text". */
export const STATUS_PREFIX = /^\[(Delivered|Pilot|Planned)\]\s*/
