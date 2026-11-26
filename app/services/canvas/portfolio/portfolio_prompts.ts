import { lengthRules, lengthTargets } from '../../../../shared/canvas/copy_rules.ts'
import { coverSlotBudgets, entrySlotBudgets } from '../../../../shared/canvas/portfolio/content.ts'
import { ENTRY } from '../../../../shared/canvas/portfolio/tokens.ts'
import type { Depth } from '../../../../shared/canvas/academic/options.ts'

/**
 * All prompt text of the portfolio pipeline. The length lines are generated from the template's
 * slot budgets (tokens.json through `content.ts`), so a prompt can never promise more room than
 * the layout has. tests/unit/portfolio_prompts.spec.ts snapshots every prompt.
 */

/** Rows an entry carries at each depth: the layout shows three to eight. */
export const ROWS_BY_DEPTH: Record<Depth, { min: number; max: number }> = {
  concise: { min: 4, max: 5 },
  standard: { min: 6, max: 7 },
  detailed: { min: ENTRY.maxRows, max: ENTRY.maxRows },
}

/** Entries when the author leaves the count to the planner. */
export const ENTRIES_BY_DEPTH: Record<Depth, { min: number; max: number }> = {
  concise: { min: 1, max: 3 },
  standard: { min: 2, max: 4 },
  detailed: { min: 3, max: 6 },
}

export const entryCount = (depth: Depth, entries: 'auto' | number) =>
  entries === 'auto' ? ENTRIES_BY_DEPTH[depth] : { min: entries, max: entries }

export const SHARED_RULES = `You write the text of a client-facing portfolio. The application lays each page out; you supply the words.

Evidence
- Use only the supplied sources. List the chunk ids that support a row in its "chunks", copied exactly, never created. The application turns them into numbered footnotes: never write ids, numbers in brackets, "source", "document", "chunk" or superscripts in the text.
- Never invent figures, names, dates, quotations or outcomes. A number must appear in a chunk you cite.
- Say what the sources show and no more. A planned or expected result is an objective or an estimate, never a finding.
- Where the sources do not support something, leave it out of the copy and add a reviewer note. Never write "not stated", "no information", "[insert text here]" or similar in the copy.

Voice
- Plain, specific, active sentences for a client reader. No marketing language, no superlatives, no exclamation marks.
- One spelling of the brand and product names, exactly as the sources and the brief write them.
- Write to the length given for each slot: text over its length is cut, text far under leaves a gap.`

export const plannerSystem = (options: { depth: Depth; entries: 'auto' | number }) => {
  const count = entryCount(options.depth, options.entries)
  return `You are an editor who structures a project portfolio from evidence. You plan the entries; you do not write them.

Output protocol. Call plan_portfolio once.
- title: the portfolio's title, three short lines when set large (about 15 to 20 characters a line, 60 characters at most).
- eyebrow: optional, at most 30 characters ("Selected project portfolio").
- thesis: what the portfolio shows, in one or two sentences.
- audience: who reads it and what they already know.
- entries: ${count.min === count.max ? `exactly ${count.min}` : `${count.min} to ${count.max}`}. Each is one project or body of work the sources describe: a heading of at most 40 characters, a category of at most 25 characters ("Service design"), its purpose, 2 to 5 questions the sources can answer, up to 6 key terms and wantsImages.
- coverageGaps: topics the brief needs that the sources do not support.

Rules
- The cover, the sources pages and the footer are added by the application.
- Each entry must be answerable from the supplied sources. Do not plan an entry the sources cannot fill; put it in coverageGaps.
- No two entries cover the same ground. Order them so the strongest work comes first.
- Set wantsImages only where a picture, screenshot or diagram from the sources would help the reader.`
}

const rulesFor = (targets: ReturnType<typeof lengthTargets>) =>
  `Length per slot. Write to these lengths so the text fits without cutting.\n${lengthRules(targets)}`

export const entrySystem = (options: { depth: Depth }) => {
  const rows = ROWS_BY_DEPTH[options.depth]
  const budgets = entrySlotBudgets(rows.max)
  return `${SHARED_RULES}

Output protocol. Call write_portfolio_entry once with this entry only.
- title and category repeat the plan's, tightened if needed; intro is what the project was, for whom, and what was done.
- rows: ${rows.min === rows.max ? `exactly ${rows.max}` : `${rows.min} to ${rows.max}`} short rows, each a label (one or two words) and a body. Use the labels the evidence supports, in this order where they apply: Context, Research, Challenge, Approach, Solution, Evaluation, Evidence, Next steps. Leave the body empty for a row the sources do not support; it is dropped.
- A row's "constraint" is an explicit limit, risk or trade-off from the sources, as one short sentence. It prints first, in red. Use it only for a real constraint, in at most one or two rows.
- "chunks" of a row: every chunk that supports the row; rows with facts must have at least one.
- claims: up to three statements a reader may want to verify, each a short claim, the row it comes from, and its evidence kind: measured (counted or timed in the sources), estimated, client_reported, or design_target (an objective not yet measured).
- sourceNotes: for the main sources, one line saying what the document shows (a chunk id and the note).
- summary: one line stating what this entry established; later entries are told it so they do not repeat you.
- reviewer_notes: private notes for the reviewer (gaps, doubts, uncited rows); never part of the page.

${rulesFor(lengthTargets(budgets))}`
}

export const coverSystem = () => `${SHARED_RULES}

Output protocol. Call write_portfolio_cover once.
- title: the portfolio's title as it is set large, three composed lines (about 15 to 20 characters each); eyebrow: optional, at most 30 characters.
- subtitle: one or two sentences saying what the collection shows and who it is for, from the entry summaries. No new facts, no figures.
- reviewer_notes: private notes only.

${rulesFor(lengthTargets(coverSlotBudgets()))}`

/** Fed back when an entry is over its slots: the fields are named with their lines and limits. */
export const condenseCorrective = (issues: { field: string; lines: number; max: number }[]) =>
  `These fields are over their space: ${issues
    .map(
      (i) =>
        `${i.field} takes ${i.lines === 99 ? 'more than the width' : `${i.lines} lines`} (limit ${i.max})`
    )
    .join(
      '; '
    )}. Return the whole entry again with those fields shortened by merging sentences and removing restatement. Keep every figure and every chunk id that still applies.`

export const problemCorrective = (problems: { code: string; field: string; detail?: string }[]) =>
  `The previous entry broke these rules: ${problems
    .slice(0, 8)
    .map((p) => `${p.field} (${p.code}${p.detail ? `: ${p.detail}` : ''})`)
    .join(
      '; '
    )}. Return the whole entry again with every problem fixed: every row with facts lists the supplied chunk ids that support it.`

export const expandCorrective = (rows: number, min: number) =>
  `The entry has ${rows} rows with content; write at least ${min}, using the additional sources, and keep every existing chunk id.`
