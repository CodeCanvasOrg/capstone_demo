import { type Data } from '@generated/data'
import { Link, useRouter } from '@adonisjs/inertia/react'
import { useForm, type SetDataAction } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import FileUploadForm from '@/components/files/form'
import { type FileUpload } from '@/components/files/card'
import { type DocumentStatus } from './status'

export type DocumentFormData = {
  title: string
  description: string | null
  status: DocumentStatus | null
  files: FileUpload[] | null
}

type DocumentFormSlot = {
  data: DocumentFormData
  setData: SetDataAction<DocumentFormData>
  errors: Partial<Record<keyof DocumentFormData, string>>
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>
}

function DocumentFormFields({ data, setData, errors }: DocumentFormSlot) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={data.title ?? ''}
          onChange={(event) => setData('title', event.target.value)}
          aria-invalid={errors.title ? 'true' : undefined}
          placeholder="Untitled document"
        />
        {errors.title && <FieldError>{errors.title}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          value={data.description ?? ''}
          onChange={(event) =>
            setData('description', event.target.value === '' ? null : event.target.value)
          }
          aria-invalid={errors.description ? 'true' : undefined}
          placeholder="Write a short description…"
        />
        {errors.description && <FieldError>{errors.description}</FieldError>}
      </div>
    </div>
  )
}

export function DocumentForm({ document }: { document?: Data.Document }) {
  const router = useRouter()

  const initialData: DocumentFormData = document
    ? {
        title: document.title ?? '',
        description: document.description ?? null,
        status: (document.status as DocumentStatus | null) ?? null,
        files:
          document.files?.map((file) => ({
            filename: file.filename ?? '',
            filetype: file.filetype,
            objectKey: file.objectKey ?? '',
            objectUrl: file.objectUrl ?? '',
          })) ?? null,
      }
    : {
        title: '',
        description: null,
        status: null,
        files: null,
      }

  const form = useForm<DocumentFormData>(initialData)

  function handleSubmit() {
    if (document) {
      router.put({ route: 'documents.update', routeParams: { id: document.id } }, form.data)
    } else {
      console.log(form.data)
      router.post({ route: 'documents.store' }, form.data)
    }
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
        <DocumentFormFields data={form.data} setData={form.setData} errors={form.errors} />
      </form>

      <div className="flex flex-col gap-1.5">
        <Label>Files</Label>
        <FileUploadForm
          files={form.data.files ?? []}
          onSubmit={(file) => form.setData('files', [...(form.data.files ?? []), file])}
          onRemove={(index) =>
            form.setData(
              'files',
              (form.data.files ?? []).filter((_, i) => i !== index)
            )
          }
          disabled={form.processing}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" onClick={handleSubmit} disabled={form.processing}>
          {form.processing ? 'Saving…' : 'Save document'}
        </Button>
        <Button asChild variant="outline">
          <Link route="documents.index">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
