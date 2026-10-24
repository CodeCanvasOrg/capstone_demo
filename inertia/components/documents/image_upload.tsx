import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import type { SelectionBookmark } from '@tiptap/pm/state'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError } from '@/lib/api'
import { useUnsavedChanges } from '@/providers/workspace_provider'
import { IconButton } from '@/components/icon_button'
import { ActionFeedback } from '@/components/action_feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ImageReceipt = { id: string; src: string; filename: string }

export function DocumentImageUpload({
  editor,
  workspaceId,
  documentId,
  disabled,
  onPendingChange,
}: {
  editor: Editor
  workspaceId: string
  documentId: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [receipt, setReceipt] = useState<ImageReceipt | null>(null)
  const selection = useRef<SelectionBookmark | null>(null)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const unavailable = useRef(disabled)
  useEffect(() => {
    unavailable.current = disabled
  }, [disabled])
  const pending = open && !!file
  useUnsavedChanges(`image-upload-${documentId}`, pending)
  useEffect(() => {
    onPendingChange(pending)
    return () => onPendingChange(false)
  }, [pending, onPendingChange])
  useEffect(() => {
    mounted.current = true
    const mapSelection = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged && selection.current)
        selection.current = selection.current.map(transaction.mapping)
    }
    editor.on('transaction', mapSelection)
    return () => {
      mounted.current = false
      request.current?.abort()
      editor.off('transaction', mapSelection)
    }
  }, [editor])

  function close() {
    request.current?.abort()
    request.current = null
    setUploading(false)
    setOpen(false)
    setFile(null)
    setAlt('')
    setReceipt(null)
    setError(null)
    selection.current = null
  }

  async function insert(event: FormEvent) {
    event.preventDefault()
    if (!file || request.current || disabled || !editor.isEditable) return
    if (
      !/\.(png|jpe?g)$/i.test(file.name) ||
      !file.size ||
      file.size > 10 * 1024 * 1024 ||
      (file.type && !['image/png', 'image/jpeg'].includes(file.type))
    ) {
      setError(new ApiError('Choose a PNG or JPEG image up to 10 MB.', 422))
      return
    }
    const controller = new AbortController()
    request.current = controller
    setUploading(true)
    setError(null)
    try {
      let image = receipt
      if (!image) {
        const data = new FormData()
        data.append('file', file)
        const result = await api<{ data: ImageReceipt }>(
          urlFor('documentImages.store', { workspaceId, documentId }),
          'POST',
          data,
          controller.signal
        )
        image = result.data
        if (!image?.id || !image.src) throw new Error('Invalid image upload response')
      }
      if (!mounted.current || controller.signal.aborted || editor.isDestroyed) return
      setReceipt(image)
      if (unavailable.current || !editor.isEditable) {
        setError(
          new ApiError('Your image is uploaded. Insert it when the document is ready to edit.', 409)
        )
        return
      }
      const position = selection.current?.resolve(editor.state.doc) ?? editor.state.selection
      const inserted = editor
        .chain()
        .focus()
        .setTextSelection({ from: position.from, to: position.to })
        .insertContent({
          type: 'image',
          attrs: {
            documentImageId: image.id,
            src: image.src,
            alt: alt.trim() || file.name,
          },
        })
        .run()
      if (!inserted) throw new Error('Unable to insert the uploaded image')
      close()
    } catch (reason) {
      if (mounted.current && !controller.signal.aborted)
        setError(
          feedbackError(
            reason,
            'Unable to upload this image. Your file is still selected; try again.'
          )
        )
    } finally {
      if (request.current === controller) {
        request.current = null
        if (mounted.current) setUploading(false)
      }
    }
  }

  return (
    <>
      <IconButton
        label="Add image"
        icon={ImagePlus}
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          selection.current = editor.state.selection.getBookmark()
          setOpen(true)
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!editor.isDestroyed) editor.commands.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
            <DialogDescription>Upload a PNG or JPEG image up to 10 MB.</DialogDescription>
          </DialogHeader>
          <form onSubmit={insert} className="space-y-4" aria-busy={uploading}>
            <div className="space-y-2">
              <Label htmlFor={`${id}-file`}>Image file</Label>
              <Input
                id={`${id}-file`}
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                disabled={uploading}
                aria-invalid={!!error}
                aria-describedby={`${id}-feedback`}
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null)
                  setReceipt(null)
                  setError(null)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-alt`}>Image description</Label>
              <Input
                id={`${id}-alt`}
                value={alt}
                maxLength={2000}
                disabled={uploading}
                placeholder="Describe what the image shows"
                onChange={(event) => setAlt(event.target.value)}
                aria-describedby={`${id}-alt-help`}
              />
              <p id={`${id}-alt-help`} className="text-sm text-muted-foreground">
                Helps people using screen readers understand your image. Defaults to the filename.
              </p>
            </div>
            <div id={`${id}-feedback`}>
              {error && <ActionFeedback error={error} />}
              {uploading && (
                <p role="status" className="text-sm text-muted-foreground">
                  Uploading image…
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!file || uploading || disabled}>
                {uploading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                {uploading ? 'Uploading…' : 'Insert image'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
