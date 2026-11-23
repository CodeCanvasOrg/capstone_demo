import {
  ACADEMIC_DESIGNS,
  wordRange,
  type AcademicDesignId,
  type Depth,
} from '../../../shared/canvas/academic/designs.ts'
import type { AcademicPage } from '../../../shared/canvas/academic/content.ts'

const SENTENCES = [
  'Built surfaces absorb solar radiation during the day and release it slowly after sunset, which keeps city centres warmer than the countryside at night.',
  'Dark roofing and paving have low reflectivity, while the loss of vegetation removes the cooling that evaporation would otherwise provide.',
  'Monitored pilot districts suggest that combined programmes outperform any single measure, although the sites differ in climate and size.',
  'Reflective coatings reduce the heat a roof stores, but they can cause glare at street level and lose reflectivity as dirt accumulates.',
  'Planners therefore set canopy targets for each neighbourhood and review the results every summer against a baseline measured before work began.',
  'Because planting depends on soil volume and water, the cost of maintaining new trees over many years remains an open question for municipal budgets.',
  'This approach makes districts comparable, shows which sites perform below expectation and explains to residents why some streets receive attention first.',
  'The evidence is drawn from a small number of sites, so it indicates a direction of travel rather than a guaranteed outcome for every city.',
]

/** Exactly `words` words of plausible academic prose, starting from sentence `offset`. */
export function prose(words: number, offset = 0): string {
  const out: string[] = []
  for (let i = offset; out.length < words; i++)
    out.push(...SENTENCES[i % SENTENCES.length].split(' '))
  const text = out.slice(0, words).join(' ')
  return /[.!?]$/.test(text) ? text : `${text.replace(/[,;:]$/, '')}.`
}

type Options = {
  chunks?: string[]
  depth?: Depth
  /** Share of the design's capacity the flowing text fills; the writer aims for 0.78 to 0.92. */
  fill?: number
  title?: string
  /** Leave paragraphs uncited (to test validation). */
  uncited?: boolean
}

/** A page of `design` with every field its layout reads, sized to the design's range at `fill`. */
export function samplePage(design: AcademicDesignId, options: Options = {}): AcademicPage {
  const { chunks = ['chunk-1', 'chunk-2'], depth = 'standard', fill = 0.85, title } = options
  const info = ACADEMIC_DESIGNS[design]
  const range = wordRange(design, depth)
  const target = Math.round(range.capacity * fill)
  const cite = (n = 0) => (options.uncited ? [] : [chunks[n % chunks.length]])
  const nDefs = info.definitions ? Math.round((info.definitions[0] + info.definitions[1]) / 2) : 0
  const defWords = design === 'key_concepts' ? 40 : 25
  const calloutWords = design === 'case_box' ? 110 : 45
  // Words of each section: an even split, except where a layout's frames differ in size.
  const even = (n: number, total: number) =>
    Array.from({ length: n }, () => Math.max(Math.floor(total / n) - 4, 30))
  const sectionWords: number[] =
    design === 'key_concepts'
      ? [40]
      : design === 'comparison'
        ? [55, 55, 55, Math.round(fill * 170)]
        : design === 'case_box'
          ? [Math.max(target - calloutWords, 60)]
          : design === 'title_page'
            ? []
            : even(Math.max(Math.round((info.sections[0] + info.sections[1]) / 2), 1), target)
  const sections = sectionWords.map((words, s) => {
    const paragraphs: AcademicPage['sections'][number]['paragraphs'] = []
    for (let left = words, k = 0; left > 0; k++) {
      const n = Math.min(left, 130)
      paragraphs.push({ text: prose(n, s * 3 + k), chunks: cite(s + k) })
      left -= n
    }
    return {
      heading: `Section ${s + 1} of the ${design.replace('_', ' ')}`,
      paragraphs,
      bullets: [],
    }
  })
  const callout = info.callout
    ? {
        kind: (design === 'case_box'
          ? 'example'
          : design === 'conclusion'
            ? 'limitation'
            : 'note') as 'example' | 'note' | 'limitation',
        title: 'In practice',
        text: prose(calloutWords, 5),
        chunks: cite(1),
      }
    : null
  return {
    design,
    title: title ?? `${info.label} page`,
    lead:
      design === 'contents' || design === 'references'
        ? null
        : {
            text: prose(design === 'title_page' ? Math.round(range.capacity * fill) : 55, 2),
            chunks: design === 'title_page' ? [] : cite(0),
          },
    sections,
    definitions: Array.from({ length: nDefs }, (_, i) => ({
      term: `Term ${i + 1}`,
      definition: prose(defWords, i),
      chunks: cite(i),
    })),
    figures: info.figures
      ? ['83%', '12', '2.4x'].map((value, i) => ({
          value,
          label: `of the monitored districts, measure ${i + 1}`,
          qualifier: 'measured' as const,
          chunks: cite(i),
        }))
      : [],
    callout,
    takeaway: design === 'title_page' ? null : prose(24, 1),
    summary: `The ${design} page argues one point.`,
    reviewer_notes: [],
  }
}
