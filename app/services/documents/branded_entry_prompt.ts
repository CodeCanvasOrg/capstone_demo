import { ENTRY_LIMITS } from '../../../shared/layout/entry.ts'

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

Citations
- footnotes: give each a numeric id, a one-sentence text stating the qualification or origin (for example "Estimates reported in the case study; no baseline was published"), and chunks copied exactly from the supplied source chunk IDs.
- Reference footnotes from results, challenge and solution with footnote_ids. Use only supplied chunk IDs; never create IDs or URLs.

Classification
- doc_type is client_case_study, product, research or news. Choose honestly; the application tells the reviewer when no template exists for the type.`
