import { Link, useRouter } from '@adonisjs/inertia/react'
import { useState } from 'react'
import { FilePlus2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { type FileUpload } from './card'
import FileUploadForm from './form'

export type UserFormData = {
  files: FileUpload[]
}

type UserFormErrors = Partial<Record<keyof UserFormData, string>>

export default function UserForm() {
  const router = useRouter()
  const [files, setFiles] = useState<FileUpload[]>([])
  const [errors, setErrors] = useState<UserFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit() {
    if (files.length === 0) {
      setErrors({ files: 'Upload at least one file to continue.' })
      return
    }

    setErrors({})
    setSubmitting(true)

    router.post(
      { route: 'files.store' },
      { files },
      {
        onError: (validationErrors: Record<string, string>) => {
          setErrors(validationErrors as UserFormErrors)
          setSubmitting(false)
        },
        onFinish: () => setSubmitting(false),
      }
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>Files</Label>
        <FileUploadForm
          files={files}
          onSubmit={(file) => setFiles((current) => [...current, file])}
          onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
          disabled={submitting}
        />
        {files.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Upload your files here, then select them when creating a document.
          </p>
        )}
        {errors.files && <p className="text-sm text-destructive">{errors.files}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSubmit} disabled={submitting || files.length === 0}>
          {submitting ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
          {submitting
            ? 'Saving…'
            : files.length > 0
              ? `Add ${files.length} ${files.length === 1 ? 'file' : 'files'}`
              : 'Add files'}
        </Button>
        <Button asChild variant="outline">
          <Link route="files.index">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
