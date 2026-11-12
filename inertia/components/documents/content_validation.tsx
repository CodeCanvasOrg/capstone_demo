import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { Selection } from '@tiptap/pm/state'
import { AlertCircle, ClipboardCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { describeField, nodeIdForField } from '../../../shared/publication/content.ts'

/** Moves the caret into the block and scrolls it into view; false if it is gone. */
function focusBlock(editor: Editor, nodeId: string) {
  const element = editor.view.dom.querySelector<HTMLElement>(
    `[data-node-id="${CSS.escape(nodeId)}"]`
  )
  if (!element) return false
  // posAtDOM is the position before the block; step to the nearest text inside it.
  const before = editor.state.doc.resolve(editor.view.posAtDOM(element, 0))
  editor.view.dispatch(editor.state.tr.setSelection(Selection.near(before, 1)))
  editor.view.focus()
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return true
}

/**
 * Accessible summary of publication field errors from a rejected save, plus the
 * count of stale annotations awaiting review. Renders nothing when both are
 * empty. Local editor content is never touched here.
 */
export function ContentValidation({
  editor,
  errors,
  needsReview,
}: {
  editor: Editor
  errors: Record<string, string>
  needsReview: number
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const fields = Object.entries(errors).filter(([field]) => field.startsWith('content.'))
  const signature = fields.map(([field]) => field).join('|')
  useEffect(() => {
    if (signature) heading.current?.focus()
  }, [signature])

  if (!fields.length && !needsReview) return null
  const publication = editor.getJSON().attrs?.publication
  return (
    <div className="space-y-3 border-b bg-sidebar p-4">
      {fields.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle ref={heading} tabIndex={-1} className="outline-none">
            {fields.length === 1
              ? 'Fix 1 problem before this saves'
              : `Fix ${fields.length} problems before this saves`}
          </AlertTitle>
          <AlertDescription>
            <p>Your text is still here. Nothing was lost.</p>
            <ul className="mt-2 min-w-0 list-disc space-y-1 pl-5">
              {fields.map(([field, message]) => {
                const nodeId = nodeIdForField(publication, field)
                return (
                  <li key={field} className="break-words">
                    <span className="font-medium">{describeField(field)}:</span> {message}{' '}
                    {nodeId && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 align-baseline"
                        onClick={() => focusBlock(editor, nodeId)}
                      >
                        Go to text<span className="sr-only"> for {describeField(field)}</span>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {needsReview > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">
            <ClipboardCheck aria-hidden="true" />
            {needsReview} to review
          </Badge>
          <span className="text-muted-foreground">
            {needsReview === 1
              ? 'An edit changed text a result or claim was attached to. The text is unchanged; the link is paused until reviewed.'
              : 'Edits changed text that results or claims were attached to. The text is unchanged; the links are paused until reviewed.'}
          </span>
        </p>
      )}
    </div>
  )
}
