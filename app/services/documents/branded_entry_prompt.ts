import { ENTRY_LIMITS, type EntryLimits } from '../../../shared/layout/entry.ts'
import type { EntryFormat } from '../../../shared/layout/formats.ts'
import type { TemplateDefinition } from '../../../shared/layout/templates.ts'

/**
 * Field-level protocol for the branded entry (feedback §07). The company guide
 * supplies voice; this supplies the output contract. The rules are tested as
 * text so a prompt edit cannot silently drop one.
 */
export const BRANDED_ENTRY_PROTOCOL = `Output protocol. Call write_branded_entry once. You fill fields; the application decides blocks, order and layout.

Copy rules
- Never write about the source. Copy must never contain phrases such as "the source does not", "the case study does not", "not specified in the documents", file names, or chunk IDs.
- If information is missing, leave the field empty (an empty string or an empty list) and add a short entry to reviewer_notes instead. Never write a sentence explaining that something is missing. reviewer_notes are shown only to internal reviewers and are never printed.
- Never invent percentages, technologies, client names, contact details, guarantees, awards or results. Preserve reported units, scope and qualifiers.
- hero.headline: at most ${ENTRY_LIMITS.headline} characters. hero.subhead: at most ${ENTRY_LIMITS.subhead} characters, one sentence.
- challenge.text: at most three sentences. solution.text: what was built and for whom.
- steps: three to ${ENTRY_LIMITS.steps} short steps (title at most ${ENTRY_LIMITS.stepTitle} characters, text at most ${ENTRY_LIMITS.stepText}). capabilities: at most ${ENTRY_LIMITS.capabilities} cards. roadmap: one line, only when planned work is named.

Results
- results: at most ${ENTRY_LIMITS.results} headline numbers worth a stat callout. value carries the figure only, for example "90%", "1,000" or "2 weeks"; put "up to" or "at least" in comparison, never in value. value must contain a number: a word or phrase such as "Faster" or "Fewer pixels" is not a stat. If the material has no real figure, omit results (an empty list) and add a reviewer note; do not invent one.
- label says what the number measures. evidence is exactly one of: measured (a reported measurement with context), estimated, client_reported, design_target (a capacity or goal, not an outcome). Keep a design target a design target and an estimate an estimate. Do not turn a research benchmark into a business result.
- Express evidence strength through the evidence field and a footnote, not a paragraph of caveats.

Hero image
- hero_image: choose at most one supplied image chunk (see imageChunkIds) that illustrates the work, such as a product shot, diagram or illustration; avoid logos, page scans and charts with small text. It is shown in the top-right corner of the hero. chunk_id must be copied exactly from imageChunkIds and alt is a short description of what the image shows (at most ${ENTRY_LIMITS.imageAlt} characters). If imageChunkIds is empty or nothing suits, omit hero_image; never invent an image or a URL.

Citations
- footnotes: give each a numeric id, a one-sentence text stating the qualification or origin (for example "Estimates reported in the case study; no baseline was published"), and chunks copied exactly from the supplied source chunk IDs.
- Reference footnotes from results, challenge and solution with footnote_ids. Use only supplied chunk IDs; never create IDs or URLs.

Classification
- doc_type is client_case_study, product, research or news. Choose honestly; the application tells the reviewer when no template exists for the type.`

/** What the selected layout template allows, so regenerated copy fits it. */
export const templateGuidance = (template: TemplateDefinition, limits: EntryLimits) =>
  `Selected layout template: "${template.title}" (${template.pageBudget} page${template.pageBudget === 1 ? '' : 's'} including sources). ${template.description}
Stay inside this template: at most ${limits.results} results, ${limits.steps} steps, ${limits.capabilities} capabilities, a roadmap of at most ${limits.roadmap} characters, and challenge and solution text of at most ${limits.paragraph} characters each. Blocks that are not required collapse when empty, so omit what does not fit rather than shortening it into filler.`

/**
 * What differs per format. Appended to the shared protocol, so the copy rules
 * stay identical and only the meaning of each field changes.
 */
export const FORMAT_PROTOCOL: Record<EntryFormat, string> = {
  case_study: '',
  portfolio: `Format: website portfolio entry. Write for a prospective client on the company website: plain language, no jargon.
- results are the "Impact" figures; give at most three, only supported ones, otherwise an empty list with a reviewer note.
- capabilities are "What we built": up to four cards, each tied to the purpose it serves. Leave capability status empty.
- roadmap is a single "Next steps" line, only when planned work is named. Leave limitations and roadmap_items empty.`,
  technical: `Format: technical entry. Write for engineers: precise, calm, never promotional.
- challenge is "The problem" and its technical constraints. solution is "The approach": the design decisions and why.
- steps are the architecture as components in data-flow order, with a short title such as "Ingest" or "Queue" (three to five).
- capabilities are the implementation: concrete mechanisms, integrations or trade-offs, up to four. Leave capability status empty.
- results are the evaluation metrics only: a measured figure with its unit in value where it is a plain unit (for example "120 ms", "95%"), what it measures and under what workload in label. Keep a design target a design_target. Never present a benchmark as a business result.
- limitations: what the evaluation did not cover and what is still open, in at most ${ENTRY_LIMITS.limitations} characters. Leave roadmap and roadmap_items empty.`,
  vision: `Format: product vision. Aspirations are always labelled as planned.
- challenge is the user need: who needs this and why. solution is the product vision: the direction, not a feature list.
- steps are "The experience": up to three steps in the order a user meets the product.
- capabilities are up to four, each with status exactly one of delivered, pilot or planned. Never infer production availability from a demo.
- results must be an empty list: a vision reports no outcomes.
- roadmap_items: up to four horizons with when ("Now", "Next", "Later") and what lands then. Leave roadmap and limitations empty.`,
}
