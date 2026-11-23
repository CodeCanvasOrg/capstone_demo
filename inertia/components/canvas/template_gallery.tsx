import { useEffect, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { urlFor } from '@/client'
import { api } from '@/lib/api'

/** A template as the gallery lists it. */
export type TemplateInfo = {
  id: string
  name: string
  category: 'brochure' | 'academic'
  designId: string | null
  version: number
  system: boolean
  previewUrl: string | null
}

const CATEGORY_LABELS = { academic: 'Academic', brochure: 'Brochure' } as const

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

/**
 * Page templates grouped by category, each with the thumbnail rendered when the
 * system templates were seeded. A template with no thumbnail shows its name only.
 */
export function TemplateGallery({
  templates,
  only,
}: {
  templates: TemplateInfo[]
  /** Show only these design ids (the designs of one template set). */
  only?: readonly string[]
}) {
  const shown = templates.filter((t) => !only || (t.designId && only.includes(t.designId)))
  const groups = (['academic', 'brochure'] as const)
    .map((category) => ({ category, items: shown.filter((t) => t.category === category) }))
    .filter((g) => g.items.length)
  if (!groups.length)
    return <p className="text-xs text-muted-foreground">No page templates are available yet.</p>
  return (
    <div className="flex flex-col gap-3" data-testid="template-gallery">
      {groups.map(({ category, items }) => (
        <section key={category} aria-label={CATEGORY_LABELS[category]}>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {CATEGORY_LABELS[category]}
          </h4>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((t) => (
              <li key={t.id} className="flex flex-col gap-1">
                <div className="flex aspect-[210/297] items-center justify-center overflow-hidden rounded-md border bg-white">
                  {t.previewUrl ? (
                    <img
                      src={t.previewUrl}
                      alt={`${t.name} page`}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <LayoutTemplate aria-hidden="true" className="size-5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate text-[11px]">{t.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
