import type { EntryFormat } from '../layout/formats.ts'

export const COMPANY_TEMPLATE_IDS = ['portfolio', 'technical', 'vision'] as const
/** The branded one-to-two page entry: structured output, rendered by the layout templates. */
export const BRANDED_TEMPLATE_ID = 'case_study'
/** The multi-page brochure: each page has its own design (see shared/brochure). */
export const BROCHURE_TEMPLATE_ID = 'brochure'
export const TEMPLATE_IDS = [
  BRANDED_TEMPLATE_ID,
  ...COMPANY_TEMPLATE_IDS,
  BROCHURE_TEMPLATE_ID,
] as const
export type OutlineDefinition = {
  schemaVersion: 2
  name: string
  description: string
  instructions: string
  outline: string
  /**
   * `branded_entry` is generated as structured fields instead of free sections;
   * `brochure_entry` as pages, each written for its own design.
   */
  format?: 'branded_entry' | 'brochure_entry'
  /** Which entry design a `branded_entry` is written in and rendered with. */
  entryFormat?: EntryFormat
}
export type OutlineTemplate = {
  id: string
  revision: string
  definition: OutlineDefinition
}
export type OutlineSection = { key: string; heading: string; level: number; placeholder: string }

/** Templates contain text and Markdown headings, never executable HTML. */
export function outlineSections(value: string): OutlineSection[] {
  if (!value.trim() || value.length > 20000)
    throw new Error('Use an outline between 1 and 20,000 characters.')
  const sections: OutlineSection[] = []
  for (const line of value.replaceAll('\r', '').split('\n')) {
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      if (heading[2].length > 200) throw new Error('Keep each heading under 200 characters.')
      sections.push({
        key: `section_${sections.length}`,
        heading: heading[2],
        level: heading[1].length,
        placeholder: '',
      })
    } else if (line.trim()) {
      if (!sections.length) throw new Error('Start the outline with # Title.')
      if (/^#{5,}\s/.test(line)) throw new Error('Use heading levels 1 through 4.')
      const section = sections.at(-1)!
      section.placeholder += `${section.placeholder ? '\n' : ''}${line}`
    }
  }
  if (
    sections.length < 2 ||
    sections.length > 40 ||
    sections[0].level !== 1 ||
    sections.slice(1).some((s) => s.level === 1)
  )
    throw new Error('Use one # Title followed by 1–39 section headings (##, ###, or ####).')
  return sections
}
