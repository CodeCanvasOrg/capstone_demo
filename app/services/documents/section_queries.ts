import { outlineSections, type OutlineDefinition } from '../../../shared/templates/outlines.ts'
import {
  DESIGNS,
  DESIGN_IDS,
  isDesign,
  isOpenPlan,
  type BrochureSelection,
} from '../../../shared/brochure/designs.ts'
import type { SectionQuery } from '#services/documents/retrieval_service'

/**
 * What to look for in the sources, one query per part of the output. The brief
 * stays in as a short anchor so a section is read in the context of its project,
 * but the section decides what is retrieved.
 */
const ANCHOR_CHARS = 240

const anchor = (title: string | null | undefined, brief: string) =>
  [title, brief.replace(/\s+/g, ' ').trim().slice(0, ANCHOR_CHARS)].filter(Boolean).join('. ')

/** One query per heading of an outline: the heading and what its placeholder asks for. */
export function outlineQueries(
  outline: OutlineDefinition,
  title: string | null | undefined,
  brief: string
): SectionQuery[] {
  let sections
  try {
    sections = outlineSections(outline.outline)
  } catch {
    return []
  }
  // The level-one heading is the document title, which the brief already covers.
  return sections
    .filter((section) => section.level > 1)
    .map((section) => ({
      key: section.key,
      label: section.heading,
      query: [section.heading, section.placeholder, anchor(title, brief)]
        .filter(Boolean)
        .join('\n'),
    }))
}

/**
 * One query per brochure page. A page whose design the author fixed looks for what
 * that design is for; wherever the model chooses, every design the author did not
 * fix is a topic worth looking for, since any of them may be chosen.
 */
export function brochureQueries(
  selection: BrochureSelection,
  title: string | null | undefined,
  brief: string
): SectionQuery[] {
  const fixed = isOpenPlan(selection) ? [] : selection.pages.filter(isDesign)
  const wanted = [
    ...new Set([
      ...fixed,
      ...(isOpenPlan(selection) || selection.pages.includes('auto')
        ? DESIGN_IDS.filter((id) => !fixed.includes(id))
        : []),
    ]),
  ]
  return wanted.map((id) => ({
    key: id,
    label: DESIGNS[id].label,
    query: [DESIGNS[id].label, DESIGNS[id].bestFor, anchor(title, brief)].join('\n'),
  }))
}
