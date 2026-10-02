'use client'

import { type Data } from '@generated/data'
import { useRouter } from '@adonisjs/inertia/react'
import { useForm } from '@inertiajs/react'
import { LoaderCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DOCUMENT_STATUSES, STATUS_META, type DocumentStatus } from './status'
import { GenerationStatusBadge } from './status'

const NO_STATUS = 'none'

const STATUS_OPTIONS = [NO_STATUS, ...DOCUMENT_STATUSES]

type DocumentMetaData = {
  title: string
  description: string | null
}

type SaveState = 'idle' | 'saving' | 'error'

export function DocumentMeta({ document }: { document: Data.Document }) {
  const router = useRouter()
  const status = (document.status as DocumentStatus | null) ?? null

  const form = useForm<DocumentMetaData>({
    title: document.title ?? '',
    description: document.description ?? '',
  })

  const [saveState, setSaveState] = useState<SaveState>('idle')

  function persist() {
    const normalized = {
      title: form.data.title,
      description: form.data.description === '' ? null : form.data.description,
      status,
      files: null,
    }

    if (
      normalized.title === (document.title ?? '') &&
      normalized.description === (document.description ?? null)
    ) {
      return
    }

    form.clearErrors()
    setSaveState('saving')
    router.put({ route: 'documents.update', routeParams: { id: document.id } }, normalized, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => setSaveState('idle'),
      onError: (errors: Record<string, string>) => {
        form.setError(errors)
        setSaveState('error')
      },
    })
  }

  function updateStatus(next: DocumentStatus | null) {
    if (next === status) {
      return
    }

    form.clearErrors()
    setSaveState('saving')
    router.put(
      { route: 'documents.update', routeParams: { id: document.id } },
      {
        title: form.data.title,
        description: form.data.description === '' ? null : form.data.description,
        status: next,
        files: null,
      },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => setSaveState('idle'),
        onError: (errors: Record<string, string>) => {
          form.setError(errors)
          setSaveState('error')
        },
      }
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 md:px-10">
      <div className="flex flex-wrap items-start gap-3">
        <input
          aria-label="Document title"
          aria-invalid={Boolean(form.errors.title)}
          aria-describedby={form.errors.title ? 'document-title-error' : undefined}
          placeholder="Untitled document"
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          onBlur={() => persist()}
          className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 font-serif text-3xl sm:text-5xl font-medium leading-tight text-foreground outline-none transition decoration-foreground/20 decoration-2 underline-offset-4 placeholder:text-muted-foreground hover:underline focus:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Select
          value={status ?? NO_STATUS}
          onValueChange={(value) => {
            const selected = STATUS_OPTIONS.includes(value)
              ? (value as DocumentStatus | typeof NO_STATUS)
              : NO_STATUS
            updateStatus(selected === NO_STATUS ? null : (selected as DocumentStatus))
          }}
        >
          <SelectTrigger
            aria-label="Document status"
            className="mt-1 w-auto gap-1.5 border-0 bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent align="end">
            {STATUS_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {item === NO_STATUS ? 'No status' : STATUS_META[item as DocumentStatus].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <GenerationStatusBadge status={document.generationStatus} />
      </div>

      <textarea
        aria-label="Document description"
        aria-invalid={Boolean(form.errors.description)}
        aria-describedby={form.errors.description ? 'document-description-error' : undefined}
        placeholder="Add a description…"
        value={form.data.description ?? ''}
        onChange={(event) => form.setData('description', event.target.value)}
        onBlur={() => persist()}
        rows={1}
        className="field-sizing-content min-w-0 resize-none rounded-md border-0 bg-transparent px-1 py-0.5 font-serif text-2xl text-muted-foreground outline-none transition placeholder:text-muted-foreground hover:bg-muted/40 focus:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      />

      {form.errors.title && (
        <p id="document-title-error" role="alert" className="px-1 text-sm text-destructive">
          {form.errors.title}
        </p>
      )}
      {form.errors.description && (
        <p id="document-description-error" role="alert" className="px-1 text-sm text-destructive">
          {form.errors.description}
        </p>
      )}

      <div aria-live="polite" className="mt-1 flex justify-end px-1">
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
