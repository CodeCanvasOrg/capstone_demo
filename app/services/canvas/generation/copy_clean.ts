import type { AcademicPage } from '../../../../shared/canvas/academic/content.ts'
import {
  ACADEMIC_DESIGNS,
  type AcademicDesignId,
} from '../../../../shared/canvas/academic/designs.ts'
import {
  enforceBrandName,
  stripGapSentences,
  stripInlineCitations,
  titleRepeats,
  unmovedNumbers,
} from '../../../../shared/canvas/copy_rules.ts'

export type CopyProblem = { code: string; field: string; detail?: string }

/**
 * Makes what the model wrote into client copy: no inline citation tags (footnote markers
 * come from the cited chunk ids), no sentences about what the sources lack (they go to
 * reviewer notes), no empty paragraphs or bullets, one spelling of the brand name.
 */
export function cleanCopy(page: AcademicPage, brand?: string) {
  const gaps: string[] = []
  const tidy = (value: string) => {
    let out = stripInlineCitations(value)
    if (brand) out = enforceBrandName(out, brand)
    return out
  }
  const prose = (value: string) => {
    const split = stripGapSentences(tidy(value))
    gaps.push(...split.gaps)
    return split.text
  }
  const next: AcademicPage = {
    ...page,
    title: tidy(page.title),
    lead: page.lead ? { ...page.lead, text: prose(page.lead.text) } : page.lead,
    sections: page.sections.map((s) => ({
      ...s,
      heading: tidy(s.heading),
      paragraphs: s.paragraphs
        .map((p) => ({ ...p, text: prose(p.text) }))
        .filter((p) => p.text.length > 0),
      bullets: s.bullets.map(prose).filter(Boolean),
    })),
    definitions: page.definitions
      .map((d) => ({ ...d, term: tidy(d.term), definition: prose(d.definition) }))
      .filter((d) => d.definition),
    figures: page.figures.map((f) => ({ ...f, label: tidy(f.label) })),
    callout: page.callout
      ? { ...page.callout, title: tidy(page.callout.title), text: prose(page.callout.text) }
      : page.callout,
    takeaway: page.takeaway ? prose(page.takeaway) : page.takeaway,
  }
  if (next.lead && !next.lead.text) next.lead = null
  if (next.callout && !next.callout.text) next.callout = null
  if (next.takeaway === '') next.takeaway = null
  next.sections = next.sections.filter((s) => s.paragraphs.length || s.bullets.length)
  return {
    page: next,
    gaps: [...new Set(gaps.map((g) => `Sources do not cover: ${g.replace(/[.!?]+$/, '')}`))],
  }
}

/** Rules a retry can fix: repeated titles and numbers left in prose instead of stat fields. */
export function copyProblems(page: AcademicPage, design: AcademicDesignId): CopyProblem[] {
  const found: CopyProblem[] = []
  const titles = [page.title, ...page.sections.map((s) => s.heading)]
  for (const r of titleRepeats(titles))
    found.push({
      code: 'repeated_title',
      field: r.b === 0 ? 'title' : `sections[${r.b - 1}].heading`,
      detail: `"${r.titles[1]}" repeats "${r.titles[0]}"`,
    })
  const slots = ACADEMIC_DESIGNS[design]?.figures
  if (slots && !page.figures.length) {
    const text = [
      page.lead?.text ?? '',
      ...page.sections.flatMap((s) => s.paragraphs.map((p) => p.text)),
    ].join(' ')
    const moved = unmovedNumbers(text, page.figures)
    if (moved.length >= 2)
      found.push({
        code: 'numbers_in_prose',
        field: 'figures',
        detail: moved.slice(0, 4).join(', '),
      })
  }
  return found
}
