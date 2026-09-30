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
import FileCard, { type FileUpload } from './card.tsx'

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'png', 'jpg', 'jpeg']
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

function toPendingCard(file: File): FileUpload {
  return {
    filename: file.name,
    filetype: `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`,
    objectKey: '',
    objectUrl: '',
  }
}

export default function FileUploadForm({
  files,
  onSubmit,
  onRemove,
  disabled,
}: FileUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  function stageFiles(list: FileList | null) {
    const accepted = Array.from(list ?? []).filter(isValidFile)
    if (accepted.length === 0) return
    setPendingFiles((current) => [...current, ...accepted])
  }

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/files/uploads', {
        method: 'POST',
        headers: { 'X-XSRF-TOKEN': getXsrfToken() },
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
    if (uploading || pendingFiles.length === 0) return

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
    if (!uploading) setDragging(true)
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
    if (!uploading) stageFiles(event.dataTransfer.files)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 border border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50',
          isDisabled && 'pointer-events-none opacity-60'
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Drag & drop files here'}</p>
        <p className="text-xs text-muted-foreground">or</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            openPicker()
          }}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={handleChange}
        />
      </div>

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
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li key={`${file.objectKey}-${index}`}>
              <FileCard file={file} onRemove={() => onRemove(index)} disabled={isDisabled} />
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
