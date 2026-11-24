import type { PagePlan } from '../../../../shared/canvas/academic/content.ts'
import type { SectionQuery } from '#services/documents/retrieval_service'

/**
 * What to look for in the sources for each page of the plan: the page's title
 * and purpose, then one query per research question. The brief stays in as a
 * short anchor, as it does for the brochure's section queries, but the page
 * decides what is retrieved.
 */
export const ANCHOR_CHARS = 200

export const anchor = (title: string | null | undefined, brief: string) =>
  [title, brief.replace(/\s+/g, ' ').trim().slice(0, ANCHOR_CHARS)].filter(Boolean).join('. ')

export type PageQuery = { key: string; label: string; queries: string[] }

export function pageQueries(
  pages: readonly PagePlan[],
  title: string | null | undefined,
  brief: string
): PageQuery[] {
  const context = anchor(title, brief)
  return pages.map((page, index) => ({
    key: String(index),
    label: page.title,
    queries: [
      // The page's own subject leads; the anchor only places it in its project.
      `${page.title}\n${page.purpose}\n${context}`.trim(),
      ...page.questions.map((question) => question.trim()).filter(Boolean),
    ],
  }))
}

/** The same queries as brochure-style section queries, for `canvas:plan` and tests. */
export const asSectionQueries = (queries: PageQuery[]): SectionQuery[] =>
  queries.map((q) => ({ key: q.key, label: q.label, query: q.queries.join('\n') }))

/** A chunk used for an earlier page counts for half on later ones, so pages reach for new evidence. */
export const REUSE_PENALTY = 0.5

export type Ranked = { id: string }

/**
 * Reciprocal-rank fusion of one page's query results: a chunk near the top of
 * several lists beats one that tops a single list. The page's own subject (the
 * first list) counts for a little more. A chunk already used on an earlier page
 * is down-ranked by `penalty`. Returns ids, best first, with their scores.
 */
export function fuse(
  lists: readonly (readonly Ranked[])[],
  used: ReadonlySet<string> = new Set(),
  penalty = REUSE_PENALTY
): { id: string; score: number }[] {
  const scores = new Map<string, number>()
  lists.forEach((list, listIndex) =>
    list.forEach((row, rank) => {
      const weight = listIndex === 0 ? 1.25 : 1
      scores.set(row.id, (scores.get(row.id) ?? 0) + weight / (60 + rank + 1))
    })
  )
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score: used.has(id) ? score * penalty : score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
