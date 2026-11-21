import { CAPS, type PageContent, type SectionContent } from '../../../shared/brochure/content.ts'
import type { DesignId } from '../../../shared/brochure/designs.ts'

const WORDS =
  'document review pipeline extracts fields checks every declaration against rules and hands staff a reviewed draft so exceptions reach people sooner'.split(
    ' '
  )

/** Realistic words up to, and never over, a length. */
export function fill(length: number, offset = 0): string {
  let out = ''
  for (let i = 0; ; i++) {
    const word = WORDS[(i + offset) % WORDS.length]
    const next = out ? `${out} ${word}` : word
    if (next.length > length) break
    out = next
  }
  return out ? out[0].toUpperCase() + out.slice(1) : 'X'.repeat(Math.min(length, 1))
}

/** A page with every field filled to its design's limit: the hardest case for the sheet. */
export function maxPage(design: DesignId): PageContent {
  const sections: SectionContent[] = CAPS[design].map((cap, s): SectionContent => {
    const section: SectionContent = { paragraphs: [], bullets: [], groups: [] }
    if (cap.title) section.title = fill(cap.title, s)
    if (cap.paragraphs)
      section.paragraphs = Array.from({ length: cap.paragraphs[1] }, (_, i) => ({
        text: fill(cap.paragraphs![2], i + s),
        chunks: [],
      }))
    if (cap.stat) section.stat = { value: '>30', label: fill(cap.stat.label) }
    if (cap.bullets)
      section.bullets = Array.from({ length: cap.bullets[0] }, (_, i) => fill(cap.bullets![1], i))
    if (cap.groups) {
      const g = cap.groups
      section.groups = Array.from({ length: g.max }, (_, i) => ({
        heading: fill(g.heading, i),
        ...(g.stat ? { stat: '83%' } : {}),
        paragraphs: Array.from({ length: g.paragraphs ?? (g.paragraph ? 1 : 0) }, (__, k) => ({
          text: fill(g.paragraph, i + k),
          chunks: [],
        })),
        bullets: Array.from({ length: g.bullets }, (__, k) => fill(g.bullet, i + k)),
      }))
    }
    if (cap.source) section.source = fill(cap.source)
    return section
  })
  // The glance grid reads "Label: a | b | c | d" rows, and the contact page ends with small print.
  if (design === 'glance')
    sections[2].bullets = Array.from(
      { length: 5 },
      (_, i) => `Row ${i + 1}: Local | Modular | Scalable | Auditable`
    )
  if (design === 'contact')
    sections[1].paragraphs[sections[1].paragraphs.length - 1].text = `Copyright 2026 ${fill(480)}`
  return { design, sections }
}
