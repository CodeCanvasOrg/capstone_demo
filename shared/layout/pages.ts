/**
 * Editor presentation logic (browser-safe, pure so it can be unit tested):
 * which section each top-level block belongs to, and how measured block
 * heights flow onto fixed-height pages. The editor measures the DOM and feeds
 * numbers in; nothing here touches the document content.
 */
export type BlockInfo = { type: string; level?: number; text: string }
export type SectionRole =
  'hero' | 'results' | 'challenge' | 'solution' | 'steps' | 'capabilities' | 'roadmap'

const HEADING_ROLES: [RegExp, SectionRole][] = [
  [/^(?:key )?results\b/i, 'results'],
  [/^(?:the )?challenge\b/i, 'challenge'],
  [/^(?:the )?solution\b/i, 'solution'],
  [/^(?:how it works|steps|process)\b/i, 'steps'],
  [/^(?:key )?capabilities\b/i, 'capabilities'],
  [/^(?:roadmap|next steps)\b/i, 'roadmap'],
]

/**
 * Role per top-level block. The first level-1 heading and a paragraph directly
 * after it are the hero; a recognised level-2 heading opens a section that
 * lasts until the next heading. Anything else has no role.
 */
export function sectionRoles(blocks: BlockInfo[]): (SectionRole | null)[] {
  const roles: (SectionRole | null)[] = []
  let current: SectionRole | null = null
  const titleAt = blocks.findIndex((block) => block.type === 'heading' && block.level === 1)
  blocks.forEach((block, index) => {
    if (index === titleAt) return void roles.push('hero')
    if (titleAt >= 0 && index === titleAt + 1 && block.type === 'paragraph')
      return void roles.push('hero')
    if (block.type === 'heading') {
      current = HEADING_ROLES.find(([pattern]) => pattern.test(block.text.trim()))?.[1] ?? null
    }
    roles.push(current)
  })
  return roles
}

/**
 * Challenge and solution sit side by side. Their blocks are measured one by one,
 * so the run is collapsed to one row: the taller column sets the height, the
 * other blocks add none, and no page may break inside the run.
 */
export function columnLayout(roles: (SectionRole | null)[], heights: number[]) {
  const out = [...heights]
  const glue = heights.map(() => false)
  let i = 0
  while (i < roles.length) {
    if (roles[i] !== 'challenge' && roles[i] !== 'solution') {
      i++
      continue
    }
    let end = i
    while (end < roles.length && (roles[end] === 'challenge' || roles[end] === 'solution')) end++
    const columns = new Map<SectionRole, number>()
    for (let j = i; j < end; j++) columns.set(roles[j]!, (columns.get(roles[j]!) ?? 0) + heights[j])
    if (columns.size === 2) {
      out[i] = Math.max(...columns.values())
      for (let j = i + 1; j < end; j++) {
        out[j] = 0
        glue[j] = true
      }
    }
    i = end
  }
  return { heights: out, glue }
}

export type PageBreak = { before: number; fill: number; page: number }
export type Pagination = {
  pageOf: number[]
  pages: number
  /** Spacer to insert before block `before`: `fill` px to the page end, then page `page` (1-based). */
  breaks: PageBreak[]
  oversized: number[]
  overBudget: boolean
  /** Used height of each page. */
  used: number[]
  /** How full the last page is, 0 to 1 (more when its content overflows). */
  lastFill: number
  /** Height of the content that sits beyond the budgeted pages. */
  excess: number
}

/**
 * Flows blocks onto pages of `pageHeight` px. A block that would cross the
 * boundary starts the next page, a block marked keep-with-next (a heading)
 * moves with its follower, a `glue` block never starts a page (it stays with
 * the block before it), and one taller than a page gets a page to itself.
 */
export function paginate(
  heights: number[],
  {
    pageHeight,
    keepWithNext = [],
    glue = [],
    budget,
  }: { pageHeight: number; keepWithNext?: boolean[]; glue?: boolean[]; budget?: number }
): Pagination {
  // Glued blocks join the unit before them, so a break can only fall between units.
  const units: { start: number; height: number; keep: boolean }[] = []
  heights.forEach((height, index) => {
    if (glue[index] && units.length) {
      units.at(-1)!.height += height
      units.at(-1)!.keep = !!keepWithNext[index]
    } else units.push({ start: index, height, keep: !!keepWithNext[index] })
  })
  const unitPage: number[] = []
  const breaks: PageBreak[] = []
  const oversizedUnits: number[] = []
  const used: number[] = [0]
  let page = 0
  units.forEach((unit, index) => {
    // A keep-with-next unit needs room for itself and the unit after it.
    const need = unit.height + (unit.keep ? (units[index + 1]?.height ?? 0) : 0)
    const current = used[page]
    const overflows =
      current > 0 && current + (need <= pageHeight ? need : unit.height) > pageHeight
    if (overflows) {
      breaks.push({ before: unit.start, fill: Math.max(0, pageHeight - current), page: page + 2 })
      page++
      used[page] = 0
    }
    if (unit.height > pageHeight) oversizedUnits.push(unit.start)
    unitPage.push(page)
    // Taller than a page: the next block starts a fresh page.
    used[page] += unit.height
  })
  const pageOf = heights.map((_, index) => {
    let unit = units.length - 1
    while (units[unit].start > index) unit--
    return unitPage[unit]
  })
  const pages = heights.length ? page + 1 : 1
  const lastUsed = used[page] ?? 0
  const budgeted = budget === undefined ? Infinity : budget
  return {
    pageOf,
    pages,
    breaks,
    oversized: oversizedUnits,
    overBudget: budget !== undefined && pages > budget,
    used,
    lastFill: pageHeight ? lastUsed / pageHeight : 0,
    excess: used.slice(budgeted === Infinity ? used.length : budgeted).reduce((a, b) => a + b, 0),
  }
}
