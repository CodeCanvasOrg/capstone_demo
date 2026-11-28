/**
 * The brief stays in each query as a short anchor, as it does for the brochure's section
 * queries, but the page or entry decides what is retrieved.
 */
export const ANCHOR_CHARS = 200

export const anchor = (title: string | null | undefined, brief: string) =>
  [title, brief.replace(/\s+/g, ' ').trim().slice(0, ANCHOR_CHARS)].filter(Boolean).join('. ')

export type PageQuery = { key: string; label: string; queries: string[] }

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
