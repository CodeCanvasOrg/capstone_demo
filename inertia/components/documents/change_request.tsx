import { editorContent, storedContent } from '@/lib/editor_content'
import { useEffect, useRef, useState } from 'react'
import type { Editor, JSONContent } from '@tiptap/react'
import { ArrowUp, LoaderCircle, Undo2, X } from 'lucide-react'
import { urlFor } from '@/client'
import { api, type ApiError, feedbackError } from '@/lib/api'
import { ActionFeedback } from '@/components/action_feedback'
import { IconButton } from '@/components/icon_button'
import { Button } from '@/components/ui/button'

type Revision = { data: { content: JSONContent; summary: string; changed: boolean } }

/** Bottom-centre prompt that asks the model for a targeted edit of the open draft. */
export function ChangeRequest({
  editor,
  workspaceId,
  documentId,
  disabled,
  onClose,
  onPendingChange,
  initialInstruction = '',
}: {
  editor: Editor
  workspaceId: string
  documentId: string
  disabled: boolean
  onClose: () => void
  onPendingChange: (pending: boolean) => void
  /** Optional starting text, e.g. a request to shorten to the page budget. */
  initialInstruction?: string
}) {
  const [instruction, setInstruction] = useState(initialInstruction)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [summary, setSummary] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    input.current?.focus()
    return () => controller.current?.abort()
  }, [])
  useEffect(() => onPendingChange(pending), [pending, onPendingChange])
  async function submit() {
    const request = instruction.trim()
    if (!request || pending || disabled) return
    controller.current = new AbortController()
    setPending(true)
    setError(null)
    setSummary('')
    setCanUndo(false)
    try {
      const result = await api<Revision>(
        urlFor('documentRevisions.store', { workspaceId, documentId }),
        'POST',
        { content: storedContent(editor), instruction: request },
        controller.current.signal
      )
      if (!result.data?.content) throw new Error('Unexpected revision response')
      if (result.data.changed) {
        // Emitting the update lets the editor autosave it as a normal version.
        editor.commands.setContent(editorContent(editor, result.data.content))
        setCanUndo(true)
      }
      setSummary(result.data.changed ? result.data.summary : 'No change was needed.')
      setInstruction('')
    } catch (reason) {
      if (!controller.current?.signal.aborted)
        setError(feedbackError(reason, 'The change could not be made. Your content is unchanged.'))
    } finally {
      setPending(false)
      requestAnimationFrame(() => input.current?.focus())
    }
  }
  return (
    <div
      id="change-request-panel"
      className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-3 sm:bottom-6"
    >
      <form
        aria-label="Ask for a change"
        aria-busy={pending}
        className="pointer-events-auto w-full max-w-xl rounded-2xl border bg-sidebar p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending) onClose()
        }}
      >
        {(summary || error) && (
          <div className="flex items-start gap-2 px-2 pt-1 pb-2 text-xs">
            {error ? (
              <div className="min-w-0 flex-1">
                <ActionFeedback error={error} />
              </div>
            ) : (
              <p role="status" className="flex-1 leading-5 text-muted-foreground">
                {summary}
              </p>
            )}
            {canUndo && !error && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  editor.commands.undo()
                  setCanUndo(false)
                  setSummary('Change undone.')
                }}
              >
                <Undo2 aria-hidden="true" />
                Undo change
              </Button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="change-request" className="sr-only">
            Describe the change
          </label>
          <textarea
            id="change-request"
            ref={input}
            rows={1}
            maxLength={2000}
            value={instruction}
            disabled={pending}
            placeholder="Ask for a change, e.g. “Make the results section shorter”"
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void submit()
              }
            }}
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <IconButton
            type="button"
            label="Close"
            icon={X}
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          />
          <IconButton
            type="submit"
            label={pending ? 'Making the change' : 'Send change request'}
            icon={pending ? LoaderCircle : ArrowUp}
            className={pending ? '[&_svg]:animate-spin' : undefined}
            disabled={pending || disabled || !instruction.trim()}
          />
        </div>
      </form>
    </div>
  )
}
