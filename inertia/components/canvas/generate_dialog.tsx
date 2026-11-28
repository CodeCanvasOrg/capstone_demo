import { LoaderCircle, Sparkles } from 'lucide-react'
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
import type { Depth } from '../../../shared/canvas/options.ts'
import type { GenerationOptions } from './generation'
import { TemplateGallery, useTemplates } from './template_gallery'

/** Rows an entry carries at each depth (the template shows three to eight). */
const DEPTHS: { value: Depth; label: string; hint: string }[] = [
  { value: 'concise', label: 'Concise', hint: '4 to 5 rows an entry' },
  { value: 'standard', label: 'Standard', hint: '6 to 7 rows an entry' },
  { value: 'detailed', label: 'Detailed', hint: '8 rows an entry' },
]

const ENTRY_CHOICES = ['auto', 1, 2, 3, 4, 5, 6] as const

const radio =
  'flex flex-1 flex-col gap-0.5 rounded-lg border p-2.5 text-left text-sm outline-none transition-[transform,background-color,border-color] duration-[160ms] ease-out focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98] aria-checked:border-primary aria-checked:bg-primary/5 motion-reduce:transition-none motion-reduce:active:scale-100'

/** What the choices add up to, in pages: a cover, then each entry with its sources page. */
export function pageSummary(entries: GenerationOptions['entries']) {
  if (entries === 'auto')
    return 'A cover, then each entry with its sources page: 2 to 4 entries for most sources.'
  const pages = 1 + entries * 2
  return `A cover and ${entries} ${entries === 1 ? 'entry' : 'entries'} with ${entries === 1 ? 'its sources page' : 'their sources pages'}: about ${pages} pages.`
}

/**
 * "Generate pages": the one template, then the choices that shape a generated portfolio, then
 * the request. Generating makes a new version, so unsaved edits are discarded and the dialog says so.
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
  const [options, setOptions] = useState<GenerationOptions>({
    ...initial,
    templateSet: 'portfolio',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { templates } = useTemplates(workspaceId, documentId, open)
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
            Writes a cited portfolio from your sources, one entry at a time, and lays it out. It
            makes a new version of this case study.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <TemplateGallery templates={templates} />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Entries</legend>
            <div role="radiogroup" aria-label="Entries" className="flex flex-wrap gap-1.5">
              {ENTRY_CHOICES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={options.entries === n}
                  className={`${radio} min-w-14 flex-none items-center px-3 py-1.5`}
                  onClick={() => patch({ entries: n })}
                >
                  <span className="font-medium">{n === 'auto' ? 'Auto' : n}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {pageSummary(options.entries)}
            </p>
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
                  <span className="text-xs text-muted-foreground">{d.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex min-w-0 flex-col gap-1.5">
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
                : `Uses your ${imageCount} uploaded image${imageCount === 1 ? '' : 's'} and pictures from your sources that are large enough to print sharp, up to four beside each entry.`}
            </p>
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
