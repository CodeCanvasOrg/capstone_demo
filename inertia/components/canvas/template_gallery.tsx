import { useEffect, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { urlFor } from '@/client'
import { api } from '@/lib/api'

/** A template as the gallery lists it. */
export type TemplateInfo = {
  id: string
  name: string
  kind: 'sheet' | 'document'
  category: 'brochure' | 'academic' | 'portfolio'
  designId: string | null
  version: number
  system: boolean
  previewUrl: string | null
}

/** The portfolio's page designs, in reading order, with what each one is for. */
export const PORTFOLIO_PAGES = [
  { id: 'cover', label: 'Cover', blurb: 'Title, subtitle and three facts on navy and gold.' },
  { id: 'entry', label: 'Entry', blurb: 'One project: intro, pictures and up to eight rows.' },
  { id: 'sources', label: 'Sources', blurb: 'The numbered documents each entry cites.' },
] as const

/** The templates of a document's workspace, once. */
export function useTemplates(workspaceId: string, documentId: string, enabled = true) {
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled || templates) return
    let cancelled = false
    api<{ data: TemplateInfo[] }>(urlFor('canvasTemplates.index', { workspaceId, documentId }))
      .then((res) => !cancelled && setTemplates(res.data))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [workspaceId, documentId, enabled, templates])
  return { templates, error }
}

/** The thumbnail of a page design, or a quiet stand-in in the template's colours before it is rendered. */
function PageThumb({
  design,
  label,
  url,
  className = '',
}: {
  design: (typeof PORTFOLIO_PAGES)[number]['id']
  label: string
  url: string | null
  className?: string
}) {
  return (
    <div
      className={`aspect-[210/297] overflow-hidden rounded-[3px] bg-white shadow-[0_1px_2px_rgba(20,33,61,.18),0_6px_16px_-4px_rgba(20,33,61,.28)] ring-1 ring-[#14213d]/10 ${className}`}
    >
      {url ? (
        <img
          src={url}
          alt={`${label} page of the portfolio template`}
          loading="lazy"
          className="size-full object-cover object-top"
        />
      ) : (
        <div
          role="img"
          aria-label={`${label} page of the portfolio template`}
          className={`size-full ${design === 'cover' ? 'bg-[#14213d]' : 'bg-[#f6f4ee]'}`}
        />
      )}
    </div>
  )
}

/**
 * The one template, as the editor shows it: its three page designs fanned out as real
 * thumbnails, each named, under the template's name. The fan spreads on hover (fine pointers
 * only) with a transform, and sits still for people who ask for less motion.
 */
export function TemplateGallery({ templates }: { templates: TemplateInfo[] | null }) {
  const pages = PORTFOLIO_PAGES.map((page) => ({
    ...page,
    url: templates?.find((t) => t.kind === 'sheet' && t.designId === page.id)?.previewUrl ?? null,
  }))
  const whole = templates?.find((t) => t.kind === 'document' && t.designId === 'portfolio')
  return (
    <div
      data-testid="template-gallery"
      className="group/template flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-6"
    >
      <div
        aria-hidden={false}
        className="relative mx-auto h-40 w-52 shrink-0 sm:mx-0"
        style={{ perspective: '600px' }}
      >
        {pages.map((page, i) => (
          <PageThumb
            key={page.id}
            design={page.id}
            label={page.label}
            url={page.url}
            className={[
              'absolute bottom-0 w-24 origin-bottom transition-transform duration-[220ms] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
              i === 0
                ? 'left-0 z-10 -rotate-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover/template:-translate-x-1.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover/template:-rotate-9'
                : i === 1
                  ? 'left-14 z-20'
                  : 'right-0 z-10 rotate-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover/template:translate-x-1.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover/template:rotate-9',
            ].join(' ')}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="text-sm font-semibold">{whole?.name ?? 'Navy and gold portfolio'}</h3>
          <p className="text-xs text-muted-foreground">
            One template for every portfolio. A cover, then an entry page and a sources page for
            each project{whole ? `. Version ${whole.version}.` : '.'}
          </p>
        </div>
        <ul className="flex flex-col gap-1 text-xs">
          {PORTFOLIO_PAGES.map((page) => (
            <li key={page.id} className="flex gap-2">
              <span className="w-14 shrink-0 font-medium">{page.label}</span>
              <span className="text-muted-foreground">{page.blurb}</span>
            </li>
          ))}
        </ul>
        {templates && !whole && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LayoutTemplate aria-hidden="true" className="size-3.5" /> Previews appear once the
            template is seeded.
          </p>
        )}
      </div>
    </div>
  )
}
