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
import type { GenerationOptions } from './generation'
import { PortfolioOptions } from './portfolio_options'
import { TemplateGallery, useTemplates } from './template_gallery'

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

          <PortfolioOptions value={options} onChange={patch} imageCount={imageCount} />

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
