import { router } from '@inertiajs/react'
import { FileText, LayoutTemplate, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { urlFor } from '@/client'
import { api, feedbackError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ConfirmAction } from '@/components/confirm_action'
import { cn } from '@/lib/utils'

/**
 * Text | Canvas: how a case study is edited. Shown on the document page and on the
 * canvas page. Switching to the canvas the first time lays the text out on A4 sheets
 * (and saves that as a version); switching back keeps the text as the canvas left it.
 */
export function EditorModeSwitch({
  workspaceId,
  documentId,
  mode,
  current,
  disabledReason,
  onError,
}: {
  workspaceId: string
  documentId: string
  /** The stored mode: whether the case study is laid out in the canvas. */
  mode: 'flow' | 'canvas'
  /** The page this switch is on. */
  current: 'text' | 'canvas'
  /** Why switching is not possible right now (unsaved text, no edit rights). */
  disabledReason?: string | null
  onError?: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const ids = { workspaceId, documentId }

  const toCanvas = async () => {
    if (mode === 'canvas') return router.visit(urlFor('documentCanvases.show', ids))
    setBusy(true)
    try {
      await api(urlFor('documentCanvases.enable', ids), 'POST', {
        mutationId: crypto.randomUUID(),
      })
      router.visit(urlFor('documentCanvases.show', ids))
    } catch (err) {
      setBusy(false)
      onError?.(feedbackError(err).message)
    }
  }

  const toText = async () => {
    setBusy(true)
    try {
      await api(urlFor('documentCanvases.disable', ids), 'POST')
      router.visit(urlFor('documents.edit', { workspaceId, id: documentId }))
    } catch (err) {
      setBusy(false)
      setConfirm(false)
      onError?.(feedbackError(err).message)
    }
  }

  const option = (value: 'text' | 'canvas') => {
    const active = current === value
    const Icon = value === 'text' ? FileText : LayoutTemplate
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={busy || (!active && Boolean(disabledReason))}
        title={!active && disabledReason ? disabledReason : undefined}
        onClick={() => {
          if (active) return
          if (value === 'canvas') void toCanvas()
          else setConfirm(true)
        }}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {busy && !active ? (
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Icon aria-hidden="true" className="size-3.5" />
        )}
        {value === 'text' ? 'Text' : 'Canvas'}
      </button>
    )
  }

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Editor"
        className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {option('text')}
        {option('canvas')}
      </div>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Go back to the text editor?"
        description="The text stays as it is in the canvas. The page designs are used again for the layout, and every saved canvas stays in the version history."
      >
        <Button onClick={() => void toText()} disabled={busy}>
          Go back
        </Button>
      </ConfirmAction>
    </>
  )
}
