export type SectionDefinition = {
  key: string
  heading: string
  required: boolean
  min: number
  max: number
  instructions: string
}
export type TemplateDefinition = {
  schemaVersion: 1
  key: string
  name: string
  description: string
  documentType: 'case_study'
  language: 'en'
  words: [number, number]
  sections: SectionDefinition[]
}
const section = (
  key: string,
  heading: string,
  min: number,
  max: number,
  instructions: string,
  required = true
): SectionDefinition => ({ key, heading, min, max, instructions, required })
export const SYSTEM_TEMPLATES: TemplateDefinition[] = [
  {
    schemaVersion: 1,
    key: 'CS-STANDARD',
    name: 'Standard',
    description: 'The challenge, the solution and what changed.',
    documentType: 'case_study',
    language: 'en',
    words: [700, 1100],
    sections: [
      section(
        'summary',
        'Summary',
        60,
        100,
        'Purpose, audience and stage. No unsupported impact claims.'
      ),
      section('context', 'Context', 100, 150, 'Problem, users and constraints from evidence.'),
      section(
        'solution',
        'Solution',
        200,
        300,
        'Explain delivered work in concrete capability groups.'
      ),
      section(
        'governance',
        'Governance',
        50,
        100,
        'Only include evidenced privacy, security or governance practices.',
        false
      ),
      section(
        'deployment',
        'Deployment',
        50,
        100,
        'Only include verified deployment and availability.',
        false
      ),
      section(
        'outcomes',
        'Outcomes',
        100,
        150,
        'Measurements require units, scope and methodology. If none exist explicitly say outcomes have not been measured.'
      ),
      section(
        'limitations',
        'Limitations',
        50,
        100,
        'Required when outcomes are unmeasured or evaluation is incomplete.',
        false
      ),
      section(
        'conclusion',
        'Conclusion',
        50,
        100,
        'Concise grounded conclusion. Do not invent contact details or CTAs.'
      ),
    ],
  },
  {
    schemaVersion: 1,
    key: 'CS-TECHNICAL',
    name: 'Technical',
    description: 'Architecture, implementation and measured evaluation.',
    documentType: 'case_study',
    language: 'en',
    words: [900, 1500],
    sections: [
      section('summary', 'Summary', 60, 100, 'Purpose and project stage.'),
      section('context', 'Context', 100, 150, 'Problem and technical constraints.'),
      section(
        'technical_approach',
        'Technical approach',
        200,
        300,
        'Architecture and decisions grounded in sources.'
      ),
      section(
        'implementation',
        'Implementation',
        200,
        300,
        'Concrete engineering work and integrations. Separate delivered and planned work.'
      ),
      section(
        'evaluation',
        'Evaluation',
        100,
        200,
        'Methodology, test scope, measurements and units. Explicitly state not measured if absent.'
      ),
      section('outcomes', 'Outcomes', 100, 200, 'Supported outcomes; no invented percentages.'),
      section(
        'limitations',
        'Limitations',
        50,
        150,
        'Required when evaluation is incomplete.',
        false
      ),
      section('conclusion', 'Conclusion', 50, 100, 'Grounded conclusion.'),
    ],
  },
  {
    schemaVersion: 1,
    key: 'CS-VISION',
    name: 'Vision',
    description: 'The user need, product direction and roadmap.',
    documentType: 'case_study',
    language: 'en',
    words: [600, 1000],
    sections: [
      section('summary', 'Summary', 50, 80, 'Purpose and stage. Do not imply a concept is live.'),
      section('user_need', 'User need', 80, 120, 'Who needs this and why.'),
      section(
        'product_vision',
        'Product vision',
        100,
        150,
        'Clearly label aspirations as planned.'
      ),
      section(
        'capabilities',
        'Capabilities',
        150,
        220,
        'Give availability per capability: delivered, pilot or planned.'
      ),
      section(
        'differentiators',
        'Differentiators',
        80,
        120,
        'Only evidenced differences; no unsupported market leadership.'
      ),
      section(
        'availability_roadmap',
        'Availability and roadmap',
        80,
        150,
        'Distinguish available features from future work.'
      ),
      section(
        'outcomes',
        'Outcomes',
        50,
        80,
        'Optional verified outcomes, or explicit not measured.',
        false
      ),
      section('conclusion', 'Conclusion', 50, 80, 'Grounded next steps, no fabricated CTA.'),
    ],
  },
]
export const PROJECT_STAGES = ['concept', 'in_development', 'pilot', 'live', 'unknown'] as const
export const IMAGE_POLICIES = ['none', 'source_only', 'optional_source'] as const
export type TemplateSetup = {
  templateVersionId: string
  language: 'en'
  stage: (typeof PROJECT_STAGES)[number]
  imagePolicy: (typeof IMAGE_POLICIES)[number]
  audience: 'internal' | 'public'
  imageChunkIds: string[]
  brandVersionId: string | null
}
