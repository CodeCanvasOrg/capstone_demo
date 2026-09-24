'use client'

import { type Data } from '@generated/data'
import { useRouter } from '@adonisjs/inertia/react'
import { useForm } from '@inertiajs/react'
import { LoaderCircle, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DOCUMENT_STATUSES, STATUS_META, type DocumentStatus } from './status'

const NO_STATUS = 'none'

const STATUS_OPTIONS = [NO_STATUS, ...DOCUMENT_STATUSES]

type DocumentMetaData = {
  title: string
  description: string | null
  status: DocumentStatus | null
}

type SaveState = 'idle' | 'saving' | 'error'

export function DocumentMeta({ document }: { document: Data.Document }) {
  const router = useRouter()

  const form = useForm<DocumentMetaData>({
    title: document.title ?? '',
    description: document.description ?? '',
    status: (document.status as DocumentStatus | null) ?? null,
  })

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedRef = useRef<DocumentMetaData>({
    title: form.data.title,
    description: form.data.description === '' ? null : form.data.description,
    status: form.data.status,
  })

  function persist(values: DocumentMetaData = form.data) {
    const normalized = {
      title: values.title,
      description: values.description === '' ? null : values.description,
      status: values.status,
    }

    if (
      normalized.title === savedRef.current.title &&
      normalized.description === savedRef.current.description &&
      normalized.status === savedRef.current.status
    ) {
      return
    }

    setSaveState('saving')
    router.put({ route: 'documents.update', routeParams: { id: document.id } }, normalized, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        savedRef.current = { ...normalized }
        setSaveState('idle')
      },
      onError: () => setSaveState('error'),
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-4 py-8 md:px-10">
      <div className="flex items-start gap-4">
        <input
          aria-label="Document title"
          placeholder="Untitled document"
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          onBlur={() => persist()}
          className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 font-serif text-5xl font-medium leading-tight text-foreground outline-none transition decoration-foreground/20 decoration-2 underline-offset-4 placeholder:text-muted-foreground/40 hover:underline focus:bg-muted/40 focus:ring-0"
        />
        <Select
          value={form.data.status ?? NO_STATUS}
          onValueChange={(value) => {
            const status = STATUS_OPTIONS.includes(value)
              ? (value as DocumentStatus | typeof NO_STATUS)
              : NO_STATUS
            const next = status === NO_STATUS ? null : (status as DocumentStatus)
            form.setData('status', next)
            persist({ ...form.data, status: next })
          }}
        >
          <SelectTrigger className="mt-1 w-auto gap-1.5 border-0 bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus:ring-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent align="end">
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === NO_STATUS ? 'No status' : STATUS_META[status as DocumentStatus].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input
        aria-label="Document description"
        placeholder="Add a description…"
        value={form.data.description ?? ''}
        onChange={(event) => form.setData('description', event.target.value)}
        onBlur={() => persist()}
        className="min-w-0 rounded-md border-0 bg-transparent px-1 py-0.5 font-serif text-2xl text-muted-foreground outline-none transition placeholder:text-muted-foreground/40 hover:bg-muted/40 focus:bg-muted/40 focus:ring-0"
      />

      {form.errors.title && <p className="px-1 text-sm text-destructive">{form.errors.title}</p>}
      {form.errors.description && (
        <p className="px-1 text-sm text-destructive">{form.errors.description}</p>
      )}

      <div className="mt-1 flex justify-end px-1">
        {saveState === 'saving' ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" />
            Saving…
          </span>
        ) : saveState === 'error' ? (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="size-3" />
            Failed to save
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">All changes saved</span>
        )}
      </div>
    </div>
  )
}
