import { type Data } from '@generated/data'
import { Link, useRouter } from '@adonisjs/inertia/react'
import { useForm, type SetDataAction } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DOCUMENT_STATUSES, STATUS_META, type DocumentStatus } from './status'

export type DocumentFormData = {
  title: string
  description: string | null
  status: DocumentStatus | null
}

const NO_STATUS = 'none'

type DocumentFormSlot = {
  data: DocumentFormData
  setData: SetDataAction<DocumentFormData>
  errors: Partial<Record<keyof DocumentFormData, string>>
  processing: boolean
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>
}

function DocumentFormFields({ data, setData, errors, processing }: DocumentFormSlot) {
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select
          value={data.status ?? NO_STATUS}
          onValueChange={(value) =>
            setData('status', value === NO_STATUS ? null : (value as DocumentStatus))
          }
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STATUS}>No status</SelectItem>
            {DOCUMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.status && <FieldError>{errors.status}</FieldError>}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={processing}>
          {processing ? 'Saving…' : 'Save document'}
        </Button>
        <Button asChild variant="outline">
          <Link route="documents.index">Cancel</Link>
        </Button>
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
      }
    : {
        title: '',
        description: null,
        status: null,
      }

  const form = useForm<DocumentFormData>(initialData)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (document) {
      router.put({ route: 'documents.update', routeParams: { id: document.id } }, form.data)
    } else {
      router.post({ route: 'documents.store' }, form.data)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DocumentFormFields
        data={form.data}
        setData={form.setData}
        errors={form.errors}
        processing={form.processing}
      />
    </form>
  )
}
