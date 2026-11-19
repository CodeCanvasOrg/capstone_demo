import { CAPS, type SectionCaps } from '../../../shared/brochure/content.ts'
import {
  DESIGNS,
  DESIGN_IDS,
  isOpenPlan,
  type BrochureSelection,
  type DesignId,
} from '../../../shared/brochure/designs.ts'

/**
 * What the model is told about the brochure. The designs are the application's; the
 * model fills the content each one asks for, within the limits it can hold. The
 * limits are generated from the same table the pages are checked against, so a
 * prompt edit cannot drift from the check.
 */

/** What each design reads, section by section, in the words the model needs. */
const READS: Record<DesignId, string> = {
  cover:
    'Section 1: title is the entry title. One paragraph is the subtitle: what this is and for whom.',
  proof:
    'Section 1: title is a closing question or call to act (for example "Ready to take the lead?"). One or two paragraphs are statements that open the page. Each card is a proof point: heading (one or two words), stat (the figure, such as "83%" or "12"), and one paragraph saying what the figure measures. source says where the figures come from.',
  article:
    'Section 1: title; paragraphs are the prose; bullets are the key points. The first card is an accent lead-in sentence and the second a large closing line: heading only, no paragraph.',
  offer:
    'Section 1: title is the offer or product name; one intro paragraph; stat is the one number that matters, with what it counts. Section 2: title such as "What we offer"; exactly three cards, each a heading and a paragraph.',
  glance:
    'Section 1: title is a headline sentence. Section 2: a short title such as "At a glance"; paragraph 1 is a caption, paragraph 2 the text of the platform band, paragraph 3 the text of the orchestration band; three or four cards, each a component with bullets for its parts. Section 3: title such as "Why <name>?"; bullets are comparison rows written "Label: cell | cell | cell | cell"; one optional card lists what sets it apart, as bullets.',
  columns:
    'Section 1: title and one intro paragraph. Section 2: a large title, an optional one-line paragraph as its subtitle, then two or three cards, each a heading, a paragraph and optional bullets.',
  insight:
    'One section with no title: two or three cards, each a heading, a paragraph and bullets. Use it to go deeper on points made on an earlier page.',
  recognition:
    'Section 1: a large display title, one or two paragraphs, and an optional card (heading and one paragraph). Section 2: a title, then three to six proof cards: heading is the award, rating or reference, one or two bullets give detail, and an optional paragraph is its source note.',
  contact:
    'Section 1: title such as "Contact us"; one card whose heading is a person\'s name and whose paragraphs are their role, email and link, one per line. Section 2: title such as "About <company>"; one to three paragraphs, the last being the copyright line.',
}

const sectionLimits = (caps: SectionCaps, index: number) => {
  const parts: string[] = []
  if (caps.title) parts.push(`title up to ${caps.title} characters`)
  if (caps.paragraphs && caps.paragraphs[1] > 0)
    parts.push(
      `${caps.paragraphs[0] === caps.paragraphs[1] ? caps.paragraphs[1] : `${caps.paragraphs[0]} to ${caps.paragraphs[1]}`} paragraph${caps.paragraphs[1] === 1 ? '' : 's'} of up to ${caps.paragraphs[2]} characters`
    )
  if (caps.stat)
    parts.push(
      `a stat with a figure up to ${caps.stat.value} characters and a label up to ${caps.stat.label}`
    )
  if (caps.bullets)
    parts.push(`up to ${caps.bullets[0]} bullets of up to ${caps.bullets[1]} characters`)
  if (caps.groups) {
    const g = caps.groups
    parts.push(
      `${g.min === g.max ? g.max : `${g.min} to ${g.max}`} cards (heading up to ${g.heading} characters${g.paragraph ? `, paragraph up to ${g.paragraph}` : ''}${g.bullets ? `, up to ${g.bullets} bullets of ${g.bullet}` : ''}${g.stat ? ', and a stat on every card' : ''})`
    )
  }
  if (caps.source) parts.push(`a source up to ${caps.source} characters`)
  return `  Section ${index + 1} limits: ${parts.join('; ')}.`
}

export const designGuide = (id: DesignId) =>
  [`- ${id} (${DESIGNS[id].label}): ${DESIGNS[id].description}`, `  Reads: ${READS[id]}`]
    .concat(CAPS[id].map(sectionLimits))
    .join('\n')

export const BROCHURE_PROTOCOL = `Output protocol. Call write_brochure once with every page. The application draws each page in its design; you supply the content that design reads.

Rules
- Never write about the source. Copy must never contain phrases such as "the source does not", "the document says", file names or chunk IDs.
- When a design needs something the sources do not support, write exactly "[insert text here]" in that field ("[#]" for a figure) so the author can fill it in. Never guess to fill a gap.
- Never invent percentages, figures, awards, client names, technologies or contact details. If something a design needs is not supported, say so in reviewer_notes and keep the page honest: use a true count or date from the sources, or use fewer, shorter items where the limits allow.
- Be detailed. Use the room each design gives you, and make every paragraph carry a fact. Stay inside the limits: text over a limit is cut from the page.
- retrievedFor lists, for each page design, the source chunks that matched it best. Start there, but any supplied chunk may support any page.
- Cite factual paragraphs by listing source chunk ids in chunks, copied exactly from the supplied sources. Never create ids.
- "design" is exactly one of: ${DESIGN_IDS.join(', ')}.
- A stat's figure is the figure only ("83%", "12", ">30", "2 weeks"); what it measures goes in the paragraph or label.

Page designs
${DESIGN_IDS.map(designGuide).join('\n')}`

/** The author's plan for the pages, or the request to decide it. */
export function planText(selection: BrochureSelection, count: { min: number; max: number }) {
  if (isOpenPlan(selection))
    return `Page plan. The author did not choose any design, so you choose the pages. Write ${count.min} to ${count.max} pages, each in the design that best fits what that page has to say for this project: read "best for" and pick accordingly. Open with a cover and, when there is a person or company to name, close with contact. Use each design at most once unless the material truly needs a second page of the same kind.

Best for:
${DESIGN_IDS.map((id) => `- ${id}: ${DESIGNS[id].bestFor}`).join('\n')}`
  const lines = selection.pages.map((page, index) =>
    page === 'auto'
      ? `Page ${index + 1}: you choose the design that best fits this project and the pages around it.`
      : `Page ${index + 1}: ${page}.`
  )
  const free = selection.pages.includes('auto')
  return `Page plan. Write exactly ${selection.pages.length} pages, in this order. Use the fixed designs exactly.
${lines.join('\n')}${
    free
      ? `\n\nWhere you choose, read "best for" and pick the design that fits:\n${DESIGN_IDS.map((id) => `- ${id}: ${DESIGNS[id].bestFor}`).join('\n')}`
      : ''
  }`
}
