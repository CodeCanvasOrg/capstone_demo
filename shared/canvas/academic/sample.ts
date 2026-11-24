import type { AcademicPage } from './content.ts'
import { ACADEMIC_DESIGNS, wordRange, type AcademicDesignId } from './designs.ts'

/**
 * Guidance text in place of content, for the system templates: each design shown
 * with its slots filled to about four fifths, so the gallery and a "new page from
 * template" look like a real page. Nothing here is a claim about any document.
 * Deterministic. Browser-safe.
 */
const GUIDANCE = [
  'Replace this text with a paragraph that opens with its claim, gives the evidence for it, explains how the evidence supports the claim and says why that matters for the page.',
  'Keep each paragraph to one idea, define a term the first time it appears and cite the source of every factual statement so a reader can check it.',
  'State what the evidence does not show as plainly as what it does, and prefer a specific noun or verb to an adjective that the sources cannot support.',
  'Close the section by saying what it adds to the argument of the whole document, so that the next page can start from there instead of repeating it.',
]

export function filler(words: number, offset = 0): string {
  const out: string[] = []
  for (let i = offset; out.length < words; i++)
    out.push(...GUIDANCE[i % GUIDANCE.length].split(' '))
  const text = out.slice(0, Math.max(words, 1)).join(' ')
  return /[.!?]$/.test(text) ? text : `${text.replace(/[,;:]$/, '')}.`
}

const evenSplit = (n: number, total: number) =>
  Array.from({ length: n }, () => Math.max(Math.floor(total / n) - 4, 30))

/** A page of `design` with guidance text, sized to about four fifths of its layout. */
export function templatePage(design: AcademicDesignId): AcademicPage {
  const info = ACADEMIC_DESIGNS[design]
  const target = Math.round(wordRange(design, 'standard').capacity * 0.8)
  const sectionWords: number[] =
    design === 'key_concepts'
      ? [40]
      : design === 'comparison'
        ? [50, 50, 50, 130]
        : design === 'case_box'
          ? [Math.max(target - 100, 60)]
          : design === 'title_page' || !info.sections[1]
            ? []
            : evenSplit(Math.max(Math.round((info.sections[0] + info.sections[1]) / 2), 1), target)
  const nDefs = info.definitions ? Math.round((info.definitions[0] + info.definitions[1]) / 2) : 0
  return {
    design,
    title: info.label,
    lead:
      design === 'contents' || design === 'references'
        ? null
        : { text: filler(design === 'title_page' ? Math.round(target) : 50, 2), chunks: [] },
    sections: sectionWords.map((words, s) => ({
      heading: `Section ${s + 1}`,
      paragraphs: [{ text: filler(words, s), chunks: [] }],
      bullets: [],
    })),
    definitions: Array.from({ length: nDefs }, (_, i) => ({
      term: `Term ${i + 1}`,
      definition: filler(design === 'key_concepts' ? 36 : 22, i),
      chunks: [],
    })),
    figures: info.figures
      ? [1, 2, 3].map((n) => ({
          value: '[#]',
          label: `what figure ${n} measures`,
          qualifier: 'measured' as const,
          chunks: [],
        }))
      : [],
    callout: info.callout
      ? {
          kind: design === 'case_box' ? 'example' : design === 'conclusion' ? 'limitation' : 'note',
          title: design === 'case_box' ? 'The case' : 'Note',
          text: filler(design === 'case_box' ? 100 : 40, 1),
          chunks: [],
        }
      : null,
    takeaway:
      design === 'title_page' ? null : 'State what this page adds to the thesis in one sentence.',
    summary: 'A template page.',
    reviewer_notes: [],
  }
}
