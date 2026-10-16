import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { cn } from 'cn'
import { toast } from 'sonner'
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
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
}

function isValidFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    toast.error(`"${file.name}" is not a supported file type`)
    return false
  }

  if (file.size > MAX_FILE_SIZE) {
    toast.error(`"${file.name}" is larger than 10MB`)
    return false
  }

  return true
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
}: FileUploadFormProps) {
  const workspaceId = useWorkspaceId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  useUnsavedChanges('file-upload', uploading || pendingFiles.length > 0)

  function stageFiles(list: FileList | null) {
    const accepted = Array.from(list ?? []).filter(isValidFile)
    if (accepted.length === 0) return
    setPendingFiles((current) => [...current, ...accepted])
  }

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/workspaces/${workspaceId}/files/uploads`, {
        method: 'POST',
        headers: {
          'X-XSRF-TOKEN': decodeURIComponent(getXsrfToken()),
          'Accept': 'application/json',
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }

      const uploaded = (await response.json()) as FileUpload
      onSubmit(uploaded)
      return true
    } catch {
      toast.error(`Could not upload "${file.name}"`)
      return false
    }
  }

  async function uploadPending() {
    if (disabled || uploading || pendingFiles.length === 0) return

    setUploading(true)
    const failed: File[] = []

    for (const file of [...pendingFiles]) {
      const uploaded = await uploadFile(file)
      if (!uploaded) failed.push(file)
    }

    setPendingFiles((current) => current.filter((file) => failed.includes(file)))
    setUploading(false)
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
        <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Drag & drop files here'}</p>
        <p className="text-xs text-muted-foreground">or</p>
        <span className="border border-border bg-card px-3 py-2 text-sm font-medium">
          Browse files
        </span>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, text, Markdown, or images · Up to 10 MB each
        </p>
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

      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul aria-live="polite" className="flex flex-col gap-2">
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
              <FileCard file={file} onRemove={() => onRemove(index)} disabled={isDisabled} />
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
