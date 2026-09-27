import { FileImage, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type FileUpload = {
  filename: string
  filetype: string | null
  objectKey: string
  objectUrl: string
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg']

type FileCardProps = {
  file: FileUpload
  onRemove?: () => void
  disabled?: boolean
}

export default function FileCard({ file, onRemove, disabled }: FileCardProps) {
  const isImage = file.filetype ? IMAGE_EXTENSIONS.includes(file.filetype) : false

  return (
    <div className="flex items-center gap-3 border border-border bg-card py-2.5 pr-2.5 pl-3">
      {isImage && file.objectUrl ? (
        <img
          src={file.objectUrl}
          alt=""
          className="size-9 shrink-0 border border-border object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center border border-border">
          {isImage ? (
            <FileImage className="size-4 text-muted-foreground" />
          ) : (
            <FileText className="size-4 text-muted-foreground" />
          )}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.filename}>
          {file.filename || 'Untitled file'}
        </p>
        <p className="text-xs text-muted-foreground">
          {file.filetype?.replace('.', '').toUpperCase() ?? 'File'}
        </p>
      </div>

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${file.filename}`}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
