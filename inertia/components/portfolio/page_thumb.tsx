import type { CSSProperties } from 'react'
import { Ribbons } from '../ribbons'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import { STAT_QUALIFIER_LABEL, type PageSpec } from '../../../shared/layout/portfolio.ts'

/**
 * A miniature of one portfolio page, drawn with the brand's own colours so the
 * strip previews what the PDF will look like. Sizes are container units, so a
 * thumbnail looks the same at any width. Decorative: the label beside it names
 * the page for assistive technology.
 */
const palette = getBrandKit('humblebee')!.palette
const tokens = {
  '--pf-navy': palette.primary,
  '--pf-yellow': palette.accent,
  '--pf-yellow-text': palette.accentText,
  '--pf-surface': palette.surface,
  '--pf-muted': palette.muted,
} as CSSProperties

export type ThumbContext = {
  /** The portfolio name, for the cover. */
  name: string
  /** The company introduction, for the statement page. */
  about?: string
  /** Case study titles by entry id. */
  titles: Record<string, string>
  /** Categories by entry id, for the contents cards. */
  categories?: Record<string, string>
  /** Every case study in order, for the contents page. */
  order?: string[]
}

export function PageThumb({
  spec,
  context,
  className = '',
}: {
  spec: PageSpec
  context: ThumbContext
  className?: string
}) {
  const kind = spec.kind
  const variant = 'variant' in spec ? spec.variant : ''
  return (
    <div
      aria-hidden="true"
      className={`pf-thumb ${className}`}
      data-kind={kind}
      data-variant={variant}
      style={tokens}
    >
      {kind === 'cover' && (
        <>
          {variant === 'ribbons' && (
            <Ribbons
              seed={context.name}
              lines={14}
              step={10}
              weight={0.7}
              stroke="var(--pf-yellow)"
              className="pf-fill"
            />
          )}
          <span className="pf-mark" />
          <b className="pf-title">{context.name}</b>
          {variant === 'panel' && <span className="pf-band" />}
        </>
      )}
      {kind === 'statement' && (
        <>
          <span className="pf-bar" />
          <p className="pf-lede">
            {(spec.kind === 'statement' && spec.text) || context.about || 'Introduction'}
          </p>
        </>
      )}
      {kind === 'highlights' && spec.kind === 'highlights' && (
        <div className="pf-stats">
          {spec.items.slice(0, 3).map((item, index) => (
            <p key={index}>
              <b>{item.value || '–'}</b>
              <span>
                {item.label}
                {item.qualifier ? ` · ${STAT_QUALIFIER_LABEL[item.qualifier]}` : ''}
              </span>
            </p>
          ))}
        </div>
      )}
      {kind === 'section' && spec.kind === 'section' && (
        <>
          <span className="pf-mark" />
          <b className="pf-title">{spec.title || 'Section'}</b>
        </>
      )}
      {kind === 'contents' && (
        <div className="pf-cards">
          <i className="pf-h">Contents</i>
          {(context.order?.length ? context.order : ['a', 'b', 'c', 'd']).slice(0, 6).map((id) => (
            <span key={id} className="pf-card">
              <em>{context.categories?.[id]}</em>
              {context.titles[id]}
            </span>
          ))}
        </div>
      )}
      {kind === 'entry' && spec.kind === 'entry' && (
        <>
          <span className="pf-hero">
            <b>{context.titles[spec.entryId] ?? 'Case study'}</b>
          </span>
          <span className="pf-lines">
            <i />
            <i />
            <i />
          </span>
        </>
      )}
      {kind === 'contact' && (
        <>
          <b className="pf-title">{getBrandKit('humblebee')!.name}</b>
          <span className="pf-lines">
            <i />
            <i />
          </span>
        </>
      )}
    </div>
  )
}
