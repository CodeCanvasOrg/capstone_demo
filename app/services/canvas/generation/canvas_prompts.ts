import {
  ACADEMIC_DESIGNS,
  DEPTH_PAGES,
  PLANNABLE_DESIGN_IDS,
  wordRange,
  type AcademicDesignId,
  type Depth,
  type Profile,
  type TemplateSet,
} from '../../../../shared/canvas/academic/designs.ts'

/**
 * All prompt text of the canvas pipeline. Design guides and word ranges are
 * generated from `shared/canvas/academic/designs.ts`, the table the validator
 * and composer read, so a prompt can never promise more room than a layout has.
 * tests/unit/canvas_prompts.spec.ts snapshots every prompt, so an edit shows up
 * in review.
 */

export const SHARED_RULES = `You write pages for a laid-out document. The application draws each page; you supply its content.

Evidence
- Use only the supplied sources. Cite every factual paragraph by listing the chunk ids that support it, copied exactly. Never create ids. Never mention sources, files, chunks or "the document".
- Never invent figures, names, dates, awards or quotations. A figure must appear in a cited chunk.
- Where the sources do not support something the page needs, write "[insert text here]" and add a reviewer note. Never pad with generic statements.

Structure
- One page develops one idea, stated in the lead. Each section advances it; no section restates another page (the plan and earlier page summaries are given to you).
- Paragraphs follow claim, evidence, explanation, significance. Open with a topic sentence. 70 to 180 words each.
- Define each key term on first use, in the definitions list or in the text.
- Use the word range given for this page's design. Write toward the upper half of the range.`

export const ACADEMIC_ADDENDUM = `Register: formal academic prose in the third person. Precise, neutral, no marketing language, superlatives or exclamation marks. Prefer specific nouns and verbs over adjectives.
Hedge in proportion to the evidence ("suggests", "is associated with") and state limitations.
Explain mechanisms and reasons ("because", "which means"), not only outcomes.
Where useful, relate the point to its wider context (method, field or prior practice) using only the sources.
Each content page ends with a takeaway sentence that states the page's contribution to the thesis.`

export const INFORMATIVE_ADDENDUM = `Register: clear, explanatory prose for an informed non-specialist. Concrete examples first, then the general point. Short sentences where possible; no jargon without a definition.
Still evidence-led and cited; no promotional claims.`

const addendum = (profile: Profile) =>
  profile === 'academic' ? ACADEMIC_ADDENDUM : INFORMATIVE_ADDENDUM

/** One design for the model: what it is for, what it reads and how many words it holds. */
export function designGuide(id: AcademicDesignId, depth: Depth = 'standard') {
  const info = ACADEMIC_DESIGNS[id]
  const range = wordRange(id, depth)
  return [
    `- ${id} (${info.label}): ${info.description}`,
    `  Best for: ${info.bestFor}`,
    `  Reads: ${info.reads}`,
    range.capacity
      ? `  Words: ${range.min} to ${range.max} in the sections' text at ${depth} depth.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Designs a template set lets the planner use; the last content page is always a conclusion. */
export const TEMPLATE_DESIGNS: Record<TemplateSet, readonly AcademicDesignId[]> = {
  academic_report: PLANNABLE_DESIGN_IDS,
  research_brief: ['figure_text', 'data_findings', 'essay', 'case_box', 'conclusion'],
  brochure: PLANNABLE_DESIGN_IDS,
}

/** How many content pages (between the title page and references) a plan has. */
export function contentPageCount(
  templateSet: TemplateSet,
  depth: Depth,
  pages: 'auto' | number
): { min: number; max: number } {
  if (pages !== 'auto') {
    // Fixed pages: a title page and references, and a contents page from six pages up.
    const fixed = pages >= 6 && templateSet === 'academic_report' ? 3 : 2
    const n = Math.max(pages - fixed, 1)
    return { min: n, max: n }
  }
  if (templateSet === 'research_brief') return { min: 2, max: 4 }
  return { min: Math.max(DEPTH_PAGES[depth].min - 2, 2), max: DEPTH_PAGES[depth].max - 2 }
}

export function plannerSystem(options: {
  profile: Profile
  depth: Depth
  templateSet: TemplateSet
  pages: 'auto' | number
}) {
  const allowed = TEMPLATE_DESIGNS[options.templateSet]
  const count = contentPageCount(options.templateSet, options.depth, options.pages)
  return `You are an editor who structures a document from evidence. You plan the content pages; you do not write them.

Output protocol. Call plan_canvas once.
- thesis: the document's central argument or purpose, in one or two sentences.
- audience: who reads it and what they already know.
- pages: ${count.min === count.max ? `exactly ${count.min}` : `${count.min} to ${count.max}`} content pages. For each: design, title, purpose (what this page must establish), 2 to 5 research questions, up to 6 key terms, and wantsImage.
- coverageGaps: topics the brief needs that the sources do not support.

Rules
- The title page, the contents and the references are added by the application. Do not plan them.
- Questions are used to search the sources, so each must be answerable from the supplied sources. Put anything the sources cannot answer in coverageGaps, never in a page's questions.
- Pages progress from context to concepts to evidence and findings to analysis to implications. Each page has its own purpose; no two pages cover the same ground.
- Choose the design that fits what the page has to say. Use each design at most twice. The last page is a conclusion.
- Set wantsImage only where a figure, diagram or photograph from the sources would help the reader, and only for a design that has an image slot.
- ${addendum(options.profile).split('\n')[0]}

Designs you may use
${allowed.map((id) => designGuide(id, options.depth)).join('\n')}`
}

/** What the writer is told for one page: the shared rules, the register and the design. */
export function writerSystem(options: {
  profile: Profile
  depth: Depth
  design: AcademicDesignId
}) {
  return `${SHARED_RULES}

${addendum(options.profile)}

Output protocol. Call write_canvas_page once with this page only.
- "design" is exactly ${options.design}.
- summary is one line stating what this page established; later pages are told it so they do not repeat you.
- reviewer_notes are private notes for the reviewer (gaps, doubts); never part of the page.
- A figure's value is the figure only ("83%", "12", "2 weeks"); what it measures goes in its label.

This page's design
${designGuide(options.design, options.depth)}`
}

/** The abstract is written last, from the summaries of every page. */
export const ABSTRACT_RULES = `This is the title page. Write the abstract as "lead": 150 to 250 words stating the question, the approach, the main findings and what they mean, in that order, from the summaries of the pages and the sources. Do not cite; do not introduce facts the pages do not contain.`

export const expandCorrective = (fill: number, words: number) =>
  `This page fills ${Math.round(fill * 100)}% of its layout. Add ${words} words of depth using the additional sources: a mechanism, a concrete example, an implication and a limitation. Keep every existing citation.`

export const condenseCorrective = (over: number, target: number) =>
  `This page exceeds its layout by ${Math.round(over * 100)}%. Reduce to ${target} words by merging overlapping sentences and removing restatement. Keep every figure and citation.`

/** Fed back to the model when a page broke the structure rules. */
export const problemCorrective = (problems: { code: string; field: string; detail?: string }[]) =>
  `The previous page broke these rules: ${problems
    .slice(0, 8)
    .map((p) => `${p.field} (${p.code}${p.detail ? `: ${p.detail}` : ''})`)
    .join(
      '; '
    )}. Return the whole page again with every problem fixed. Cite every factual paragraph with supplied chunk ids, and use only figures that appear in the chunks you cite.`
