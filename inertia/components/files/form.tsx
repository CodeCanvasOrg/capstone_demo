import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { cn } from 'cn'
import { ApiError, responseError, feedbackError } from '@/lib/api'
import { ActionFeedback } from '@/components/action_feedback'
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FileCard, { type FilePreview, type FileUpload } from './card.tsx'

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'md', 'markdown', 'txt', 'png', 'jpg', 'jpeg']
const MAX_FILE_SIZE = 10 * 1024 * 1024

function getXsrfToken() {
  return (
    document.cookie
      .split(';')
      .find((part) => part.trim().startsWith('XSRF-TOKEN='))
      ?.split('=')
      .slice(1)
      .join('=') ?? ''
  )
}

type FileUploadFormProps = {
  files: FileUpload[]
  onSubmit: (file: FileUpload) => void
  onRemove: (index: number) => void
  disabled?: boolean
  /** Links each upload to this project; omitted uploads go to the workspace library. */
  projectId?: string | null
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_EXTENSIONS.includes(extension))
    return 'Choose a PDF, DOCX, text, Markdown, PNG, or JPG file.'
  if (file.size > MAX_FILE_SIZE) return 'Choose a file up to 10 MB.'
  return null
}

function toPendingCard(file: File): FilePreview {
  return {
    filename: file.name,
    filetype: `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`,
    objectKey: '',
    downloadUrl: '',
  }
}

export default function FileUploadForm({
  files,
  onSubmit,
  onRemove,
  disabled,
  projectId,
}: FileUploadFormProps) {
  const workspaceId = useWorkspaceId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Map<File, ApiError>>(new Map())
  const [rejected, setRejected] = useState<{ name: string; message: string }[]>([])
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useUnsavedChanges('file-upload', uploading || pendingFiles.length > 0)

  function stageFiles(list: FileList | null) {
    if (disabled || inFlight.current) return
    const accepted: File[] = []
    const invalid: { name: string; message: string }[] = []
    for (const file of Array.from(list ?? [])) {
      const message = validateFile(file)
      if (message) invalid.push({ name: file.name, message })
      else accepted.push(file)
    }
    setRejected(invalid)
    setPendingFiles((current) => [...current, ...accepted])
  }

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    if (projectId) formData.append('projectId', projectId)
    try {
      const response = await fetch(`/workspaces/${workspaceId}/files/uploads`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-XSRF-TOKEN': decodeURIComponent(getXsrfToken()),
          'Accept': 'application/json',
        },
        body: formData,
      }).catch(() => {
        throw new ApiError('Connection lost. Check your internet and try again.', 0)
      })
      const uploaded = (await response.json().catch(() => null)) as FileUpload | null
      if (!response.ok) throw responseError(response.status, uploaded)
      if (!uploaded || typeof uploaded.id !== 'string' || typeof uploaded.filename !== 'string')
        throw new ApiError(
          'The upload could not be confirmed. Check the library before uploading again.',
          response.status
        )
      if (mounted.current) onSubmit(uploaded)
      return true
    } catch (reason) {
      if (mounted.current)
        setErrors((current) =>
          new Map(current).set(
            file,
            feedbackError(reason, 'This file could not upload. Try again.')
          )
        )
      return false
    }
  }

  async function uploadPending(only?: File) {
    if (disabled || inFlight.current || pendingFiles.length === 0) return
    inFlight.current = true
    setUploading(true)
    const batch = only ? [only] : [...pendingFiles]
    try {
      for (const file of batch) {
        if (!mounted.current) break
        setErrors((current) => {
          const next = new Map(current)
          next.delete(file)
          return next
        })
        const uploaded = await uploadFile(file)
        if (uploaded && mounted.current)
          setPendingFiles((current) => current.filter((item) => item !== file))
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setUploading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void uploadPending()
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragCounter.current += 1
    if (!disabled && !uploading) setDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (!disabled && !uploading) stageFiles(event.dataTransfer.files)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    stageFiles(event.target.files)
    event.target.value = ''
  }

  function openPicker() {
    if (!disabled && !uploading) inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const isDisabled = disabled || uploading

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={uploading}>
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Choose or drop source files"
        aria-disabled={isDisabled}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          dragging
            ? 'border-foreground bg-secondary'
            : 'border-muted-foreground bg-secondary/30 hover:bg-secondary',
          isDisabled && 'pointer-events-none opacity-60'
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-card">
          <UploadCloud aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Drop or browse files'}</p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, PNG, JPG · 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg"
          className="sr-only"
          tabIndex={-1}
          aria-label="Source files"
          disabled={isDisabled}
          onChange={handleChange}
        />
      </div>

      {rejected.length > 0 && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3">
          {rejected.map((item, index) => (
            <p key={index} className="break-words text-xs text-destructive">
              <strong>{item.name}</strong>: {item.message}
            </p>
          ))}
          <Button variant="ghost" size="xs" type="button" onClick={() => setRejected([])}>
            Dismiss
          </Button>
        </div>
      )}
      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <FileCard
                  file={toPendingCard(file)}
                  onRemove={() =>
                    setPendingFiles((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                  disabled={isDisabled}
                />
                <ActionFeedback
                  error={errors.get(file)}
                  busy={isDisabled}
                  onRetry={() => void uploadPending(file)}
                />
              </li>
            ))}
          </ul>
          <Button type="submit" disabled={isDisabled || pendingFiles.length === 0}>
            {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
            {uploading
              ? 'Uploading…'
              : `Upload ${pendingFiles.length} ${pendingFiles.length === 1 ? 'file' : 'files'}`}
          </Button>
        </div>
      )}

      {files.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li key={`${file.id}-${index}`}>
              <FileCard
                file={file}
                onRemove={() => onRemove(index)}
                removeLabel={`Remove ${file.filename} from list`}
                disabled={isDisabled}
              />
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
