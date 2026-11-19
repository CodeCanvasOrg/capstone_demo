import { PAGE_CATALOG, type PageSpec } from '../../../shared/layout/portfolio.ts'
import { PageThumb, type ThumbContext } from './page_thumb'

export type StripPage = { id: string; start: number; count: number; spec: PageSpec }

/** "p. 4" for one sheet, "pp. 6–7" for a case study that runs longer. */
export const pageRange = (start: number, count: number) =>
  count > 1 ? `pp. ${start}–${start + count - 1}` : `p. ${start}`

export function pageLabel(spec: PageSpec, context: ThumbContext) {
  if (spec.kind === 'entry') return context.titles[spec.entryId] ?? 'Case study'
  if (spec.kind === 'section') return spec.title || PAGE_CATALOG.section.label
  return PAGE_CATALOG[spec.kind].label
}

/**
 * Every page of a design in order, with the page numbers the PDF will have.
 * Selectable when `onSelect` is given. The entrance stagger runs once, on the
 * first twelve pages only, and is skipped for reduced motion.
 */
export function PageStrip({
  pages,
  context,
  selectedId,
  onSelect,
  label,
  size = 'md',
}: {
  pages: StripPage[]
  context: ThumbContext
  selectedId?: string | null
  onSelect?: (id: string) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <ol aria-label={label} className="pf-strip" data-size={size}>
      {pages.map((page, index) => {
        const name = pageLabel(page.spec, context)
        const inner = (
          <>
            <PageThumb spec={page.spec} context={context} />
            <span className="pf-cap">
              <span className="pf-cap-name">{name}</span>
              <span className="pf-cap-no">{pageRange(page.start, page.count)}</span>
            </span>
          </>
        )
        return (
          <li
            key={page.id}
            className="pf-item"
            style={{ '--i': Math.min(index, 6) } as React.CSSProperties}
          >
            {onSelect ? (
              <button
                type="button"
                className="pf-pick"
                aria-pressed={selectedId === page.id}
                aria-label={`${name}, ${pageRange(page.start, page.count)}`}
                onClick={() => onSelect(page.id)}
              >
                {inner}
              </button>
            ) : (
              <div
                className="pf-pick"
                role="group"
                aria-label={`${name}, ${pageRange(page.start, page.count)}`}
              >
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
