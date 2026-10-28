import type { CanonicalContent } from '../../shared/templates/content.ts'
import type { TemplateDefinition } from '../../shared/templates/catalog.ts'
export function templateContent(
  template: TemplateDefinition,
  stage: CanonicalContent['stage'] = 'unknown'
): CanonicalContent {
  const sections = template.sections.filter((s) => s.required || s.key === 'limitations')
  const count = Math.floor((template.words[0] + template.words[1]) / 2 / sections.length / 6)
  return {
    schemaVersion: 1,
    title: 'Evidence example',
    description: 'A grounded fictional project case study.',
    language: 'en',
    stage,
    outcomeStatus: 'not_measured',
    sections: sections.map((s, index) => ({
      key: s.key,
      blocks: [
        {
          id: `generated-${index}`,
          type: 'paragraph',
          evidenceIds: [],
          text: `${s.key === 'outcomes' || s.key === 'summary' ? 'Outcomes are not measured. ' : ''}${'Grounded project narrative with explicit boundaries. '.repeat(count)}`,
        },
      ],
    })),
  }
}
