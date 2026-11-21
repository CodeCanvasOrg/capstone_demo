import { hashOf } from './hash.ts'
import {
  CONTENTS_ROWS_PER_PAGE,
  groupEntries,
  planPages,
  reconcileDesign,
  rulesDesign,
  type PortfolioDesign,
  type Stat,
} from './portfolio.ts'

export { CONTENTS_ROWS_PER_PAGE }

/**
 * Portfolio collection manifest, budget and contents (PRT-01/02/03). A manifest
 * pins entry revisions, order, template and brand versions plus wrapper copy;
 * its hash is what a collection approval binds to. Page numbers come from the
 * actual page counts of composed entries, never from a stored guess.
 */
export type CollectionEntry = {
  entryId: string
  revisionId: string
  title: string
  category: string
  templateId: string
  templateVersion: number
  /** Actual or measured page count of this entry's composed output. */
  pages: number
  /** Private evidence identities, used only for deduplicated statistics. */
  evidenceKeys: string[]
  /**
   * Headline figures taken from the entry's own results when it was pinned, so
   * a highlights page can show them without reading the entry again. Absent
   * when the entry has none.
   */
  stats?: Stat[]
}

export type Wrapper = {
  about?: string
  contact?: { email?: string; website?: string; phone?: string }
}

export type Manifest = {
  version: 1
  /** Part of the hash, so a rename is a change that stale writers conflict on. */
  name?: string
  brand: { id: string; version: number }
  wrapper: Wrapper
  entries: CollectionEntry[]
  /**
   * The page-by-page design. Absent means the classic arrangement, so a
   * collection made before designs existed keeps its meaning and its hash.
   */
  design?: PortfolioDesign
}

export const buildManifest = (input: {
  name?: string
  entries: CollectionEntry[]
  wrapper: Wrapper
  brand: { id: string; version: number }
  design?: PortfolioDesign
}): Manifest => ({
  version: 1,
  ...(input.name ? { name: input.name } : {}),
  brand: { ...input.brand },
  wrapper: structuredClone(input.wrapper),
  entries: input.entries.map((entry) => ({ ...entry })),
  ...(input.design ? { design: structuredClone(input.design) } : {}),
})

/** The design a manifest renders: its own, or the classic arrangement. */
export const effectiveDesign = (
  manifest: Pick<Manifest, 'design' | 'wrapper'>,
  entries: CollectionEntry[]
): PortfolioDesign =>
  manifest.design
    ? reconcileDesign(manifest.design, entries, manifest.wrapper)
    : rulesDesign(entries, manifest.wrapper, 'classic', 'rules')

export const manifestHash = (manifest: Manifest) => hashOf(manifest)

type Row = { entryId: string; title: string; category: string; page: number }

/**
 * Category-aware contents with real page numbers. The contents page count
 * affects every later page number, so this iterates a bounded number of times
 * and reports non-convergence instead of ignoring it.
 */
export function composeContents(
  entries: CollectionEntry[],
  {
    maxPasses = 5,
    about = true,
    design,
  }: { maxPasses?: number; about?: boolean; design?: PortfolioDesign } = {}
) {
  const groups = groupEntries(entries)
  const used =
    design ?? rulesDesign(entries, { about: about ? 'x' : undefined }, 'classic', 'rules')
  const plan = planPages(used, entries)
  // A design without a contents page needs none, which settles like a one-page contents.
  const needed = plan.contentsPages || 1
  let contentsPages = 1
  let converged = false
  for (let pass = 0; pass < maxPasses; pass++) {
    if (needed === contentsPages) {
      converged = true
      break
    }
    contentsPages = needed
  }
  const rows: Row[] = plan.rows
  return {
    rows,
    converged,
    contentsPages: plan.contentsPages,
    groups: [...groups].map(([category, items]) => ({
      category,
      entryIds: items.map((item) => item.entryId),
    })),
  }
}

export type BudgetSuggestion =
  | { kind: 'use_concise'; resultingTotal: number }
  | { kind: 'remove_entries'; count: number; resultingTotal: number }

export function collectionBudget(manifest: Manifest, { target }: { target?: number }) {
  const entries = manifest.entries
  if (!entries.length)
    return {
      error: 'empty_selection' as const,
      wrapperPages: 0,
      contentsPages: 0,
      entryPages: 0,
      total: 0,
      over: false,
      overBy: 0,
      suggestions: [] as BudgetSuggestion[],
    }
  const planFor = (list: CollectionEntry[]) => planPages(effectiveDesign(manifest, list), list)
  const wrapperFor = (list: CollectionEntry[]) => planFor(list).wrapperPages
  const entryPages = entries.reduce((sum, entry) => sum + entry.pages, 0)
  const wrapperPages = wrapperFor(entries)
  const total = wrapperPages + entryPages
  const over = target !== undefined && total > target
  const overBy = over ? total - target! : 0

  const suggestions: BudgetSuggestion[] = []
  if (over) {
    const concise = wrapperPages + entries.length
    if (entries.some((entry) => entry.pages > 1) && concise < total)
      suggestions.push({ kind: 'use_concise', resultingTotal: concise })
    // Drop the longest entries first until the target is met.
    const remaining = [...entries].sort((a, b) => b.pages - a.pages)
    let count = 0
    while (remaining.length > 1 && wrapperFor(remaining) + sum(remaining) > target!) {
      remaining.shift()
      count++
    }
    if (count)
      suggestions.push({
        kind: 'remove_entries',
        count,
        resultingTotal: wrapperFor(remaining) + sum(remaining),
      })
  }
  return {
    wrapperPages,
    contentsPages: planFor(entries).contentsPages,
    entryPages,
    total,
    over,
    overBy,
    suggestions,
    error: undefined as 'empty_selection' | undefined,
  }
}

const sum = (list: CollectionEntry[]) => list.reduce((total, entry) => total + entry.pages, 0)

/** Selects, filters and orders saved entries; ids that are not in the list are rejected. */
export function selectEntries(
  list: CollectionEntry[],
  { include, order, category }: { include?: string[]; order?: string[]; category?: string }
) {
  const byId = new Map(list.map((entry) => [entry.entryId, entry]))
  const rejected = (include ?? []).filter((id) => !byId.has(id))
  let entries = include
    ? include.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
    : [...list]
  if (category) entries = entries.filter((entry) => entry.category === category)
  if (order) {
    const position = new Map(order.map((id, index) => [id, index]))
    entries = [...entries].sort(
      (a, b) => (position.get(a.entryId) ?? Infinity) - (position.get(b.entryId) ?? Infinity)
    )
  }
  return { entries, rejected }
}

/**
 * Aggregates only from explicit, deduplicated evidence. The entry count is a
 * count of portfolio entries; it is never presented as delivered projects.
 */
export function companyStatistics(entries: CollectionEntry[]) {
  return {
    entries: entries.length,
    evidenceBackedSources: new Set(entries.flatMap((entry) => entry.evidenceKeys)).size,
  }
}

const tokens = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
  )
const jaccard = (a: Set<string>, b: Set<string>) => {
  const shared = [...a].filter((value) => b.has(value)).length
  const union = new Set([...a, ...b]).size
  return union ? shared / union : 0
}

export type DuplicateSuggestion = {
  entryIds: [string, string]
  reason: string
  choices: ['keep', 'group', 'exclude']
}

/**
 * Suggestions need both overlapping evidence and a similar title, so distinct
 * projects with similar names stay available. Nothing is merged or deleted;
 * the reviewer chooses keep, group or exclude.
 */
export function suggestDuplicates(entries: CollectionEntry[]): DuplicateSuggestion[] {
  const out: DuplicateSuggestion[] = []
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      const evidence = jaccard(new Set(a.evidenceKeys), new Set(b.evidenceKeys))
      const title = jaccard(tokens(a.title), tokens(b.title))
      if (evidence >= 0.5 && title >= 0.5) {
        const shared = a.evidenceKeys.filter((key) => b.evidenceKeys.includes(key)).length
        out.push({
          entryIds: [a.entryId, b.entryId],
          reason: `Similar titles and ${shared} shared source${shared === 1 ? '' : 's'}.`,
          choices: ['keep', 'group', 'exclude'],
        })
      }
    }
  return out
}
