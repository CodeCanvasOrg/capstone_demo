import PublicationProjectionService from '#services/documents/publication_projection_service'
import { isFigure } from '../../../shared/layout/figure.ts'
import type { Stat } from '../../../shared/layout/portfolio.ts'

const PREFIX = { up_to: 'Up to ', at_least: 'At least ' } as const

/**
 * Headline figures from an entry's own results, for a highlights page. Only a
 * real figure with a stated unit qualifies, and it keeps its qualifier, so an
 * estimate never reads as a measurement. Anything that cannot be projected
 * safely yields no figures; a portfolio page never invents a number.
 */
export function entryStats(content: unknown, max = 3): Stat[] {
  try {
    const { client } = new PublicationProjectionService().project(content as never)
    const out: Stat[] = []
    for (const result of client.results ?? []) {
      const label = (result.units ?? result.scope ?? '').trim()
      if (!label || !isFigure(result.value)) continue
      const prefix =
        result.comparison && result.comparison in PREFIX
          ? PREFIX[result.comparison as keyof typeof PREFIX]
          : ''
      const value = `${prefix}${result.value.trim()}`
      if (value.length > 16) continue
      out.push({ value, label: label.slice(0, 60), qualifier: result.qualifier })
      if (out.length === max) break
    }
    return out
  } catch {
    return []
  }
}
