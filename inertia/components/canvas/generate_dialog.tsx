import { BookOpen, FileText, LayoutTemplate, LoaderCircle, Newspaper, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  ACADEMIC_DESIGN_IDS,
  PLANNABLE_DESIGN_IDS,
  wordRange,
  type Depth,
  type TemplateSet,
} from '../../../shared/canvas/academic/designs.ts'
import type { GenerationOptions } from './generation'
import { TemplateGallery, useTemplates } from './template_gallery'

const PROFILES = [
  { value: 'academic', label: 'Academic', hint: 'Formal, third person, hedged to the evidence' },
  { value: 'informative', label: 'Informative', hint: 'Plain explanation for an informed reader' },
] as const

const DEPTHS: { value: Depth; label: string }[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
]

const SETS: {
  value: TemplateSet
  label: string
  blurb: string
  icon: typeof FileText
  /** Designs the set uses, for its thumbnails. */
  designs: readonly string[]
}[] = [
  {
    value: 'academic_report',
    label: 'Academic report',
    blurb: 'Title page, contents, essay pages, conclusion and references.',
    icon: BookOpen,
    designs: ACADEMIC_DESIGN_IDS,
  },
  {
    value: 'research_brief',
    label: 'Research brief',
    blurb: '4 to 6 pages: a figure, the findings and a conclusion.',
    icon: FileText,
    designs: [
      'title_page',
      'figure_text',
      'data_findings',
      'essay',
      'case_box',
      'conclusion',
      'references',
    ],
  },
  {
    value: 'brochure',
    label: 'Brochure',
    blurb: 'The marketing page designs, written in one pass.',
    icon: Newspaper,
    designs: [],
  },
]

/** Average words a content page holds at a depth: its flowing text, a lead and a takeaway. */
export function wordsAPage(depth: Depth) {
  const ranges = PLANNABLE_DESIGN_IDS.map((id) => wordRange(id, depth))
  const mean = ranges.reduce((n, r) => n + (r.min + r.max) / 2, 0) / ranges.length
  return Math.round((mean + 90) / 10) * 10
}

const radio =
  'flex flex-1 flex-col gap-0.5 rounded-lg border p-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-primary aria-checked:bg-primary/5'

/**
 * "Generate pages": the choices that shape a generated document, then the request.
 * Generating makes a new version, so unsaved edits are discarded and the dialog says so.
 */
export function GenerateDialog({
  open,
  onOpenChange,
  workspaceId,
  documentId,
  baseVersionId,
  initial,
  imageCount,
  unsaved,
  onStarted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  documentId: string
  baseVersionId: () => string | null
  initial: GenerationOptions
  imageCount: number
  unsaved: boolean
  onStarted: () => void
}) {
  const [options, setOptions] = useState<GenerationOptions>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { templates } = useTemplates(workspaceId, documentId, open)
  const set = SETS.find((s) => s.value === options.templateSet)!
  const patch = (next: Partial<GenerationOptions>) => setOptions((o) => ({ ...o, ...next }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(urlFor('canvasGenerations.store', { workspaceId, documentId }), 'POST', {
        mutationId: crypto.randomUUID(),
        baseVersionId: baseVersionId(),
        options,
      })
      onOpenChange(false)
      onStarted()
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'Pages are already being generated, or a newer version exists. Reload the canvas and try again.'
          : feedbackError(err).message
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate pages</DialogTitle>
          <DialogDescription>
            Writes detailed, cited pages from your sources, one page at a time, and lays them out.
            It makes a new version of this case study.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Style</legend>
            <div role="radiogroup" aria-label="Style" className="flex gap-2">
              {PROFILES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={options.profile === p.value}
                  className={radio}
                  onClick={() => patch({ profile: p.value })}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Depth</legend>
            <div role="radiogroup" aria-label="Depth" className="flex gap-2">
              {DEPTHS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={options.depth === d.value}
                  className={radio}
                  onClick={() => patch({ depth: d.value })}
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ≈ {wordsAPage(d.value)} words a page
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Template set</legend>
            <div role="radiogroup" aria-label="Template set" className="grid grid-cols-3 gap-2">
              {SETS.map((s) => {
                const Icon = s.icon
                const thumb = templates?.find(
                  (t) => t.designId === s.designs[0] && t.previewUrl
                )?.previewUrl
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={options.templateSet === s.value}
                    className={`${radio} flex-none`}
                    onClick={() => patch({ templateSet: s.value })}
                  >
                    <span className="mb-1 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border bg-white">
                      {thumb ? (
                        <img src={thumb} alt="" className="size-full object-cover object-top" />
                      ) : (
                        <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
                      )}
                    </span>
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.blurb}</span>
                  </button>
                )
              })}
            </div>
            {templates && set.designs.length > 0 && (
              <details className="mt-1 text-sm">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <LayoutTemplate aria-hidden="true" className="size-3.5" /> Page designs in this
                  set
                </summary>
                <div className="mt-2">
                  <TemplateGallery templates={templates} only={set.designs} />
                </div>
              </details>
            )}
          </fieldset>

          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="canvas-pages" className="text-sm font-medium">
                Pages
              </label>
              <select
                id="canvas-pages"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={String(options.pages)}
                onChange={(e) =>
                  patch({ pages: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })
                }
              >
                <option value="auto">Auto</option>
                {Array.from({ length: 14 }, (_, i) => i + 3).map((n) => (
                  <option key={n} value={n}>
                    {n} pages
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  id="canvas-images"
                  checked={options.images}
                  onCheckedChange={(images) => patch({ images })}
                />
                <label htmlFor="canvas-images" className="text-sm font-medium">
                  Include images
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {imageCount === 0
                  ? 'This document has no uploaded images. Pictures from your sources are used when they are large enough to print sharp.'
                  : `Uses your ${imageCount} uploaded image${imageCount === 1 ? '' : 's'} and pictures from your sources that are large enough to print sharp.`}
              </p>
            </div>
          </div>

          {unsaved && (
            <p
              role="alert"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-900 dark:text-amber-200"
            >
              You have unsaved edits. Generating creates a new version and discards them. Save first
              if you want to keep them.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            Generate pages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
