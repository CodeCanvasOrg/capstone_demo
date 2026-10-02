import { type Data } from '@generated/data'
import { Link, useRouter } from '@adonisjs/inertia/react'
import { useForm } from '@inertiajs/react'
import { ArrowLeft, CalendarDays, ExternalLink, FileImage, FileText, Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'

import { ProcessingStatusBadge, StatusBadge } from '@/components/documents/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { type InertiaProps } from '@/types'

type FileFormData = {
  filename: string
  filetype: string | null
  objectKey: string
  objectUrl: string
}

const IMAGE_TYPES = ['.png', '.jpg', '.jpeg']

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getFileType(filetype: string | null) {
  return filetype?.replace('.', '').toUpperCase() || 'FILE'
}

export default function Edit({ file }: InertiaProps<{ file: Data.File }>) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const documents = file.documents ?? []
  const filename = file.filename || 'Untitled file'
  const isImage = file.filetype ? IMAGE_TYPES.includes(file.filetype.toLowerCase()) : false
  const processingStatus = file.processingStatus ?? 'uploaded'
  const isProcessing = processingStatus === 'uploaded' || processingStatus === 'processing'
  const form = useForm<FileFormData>({
    filename: file.filename ?? '',
    filetype: file.filetype,
    objectKey: file.objectKey ?? '',
    objectUrl: file.objectUrl ?? '',
  })

  useEffect(() => {
    if (!isProcessing) return

    const interval = setInterval(() => {
      router.visit(
        { href: window.location.href },
        { only: ['file'], preserveScroll: true, preserveState: true }
      )
    }, 2500)

    return () => clearInterval(interval)
  }, [isProcessing, router])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    form.clearErrors()
    setSubmitting(true)
    router.put({ route: 'files.update', routeParams: { id: file.id } }, form.data, {
      preserveScroll: true,
      onError: (errors: Record<string, string>) => form.setError(errors),
      onFinish: () => setSubmitting(false),
    })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="flex h-14 w-full items-center gap-2 px-4 md:px-10">
          <Link
            route="files.index"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to files
          </Link>
          {file.objectUrl && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href={file.objectUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open file
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <Head title={filename} />
        <PageIntro
          eyebrow="Your source library / File details"
          title="Edit file"
          description={filename}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ProcessingStatusBadge status={processingStatus} />
              <Badge variant="outline" className="h-6 px-2.5">
                {getFileType(file.filetype)}
              </Badge>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="border border-border shadow-none">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Preview</CardTitle>
                <CardDescription>View the file stored in your library.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex min-h-64 items-center justify-center bg-muted/30 p-6 md:min-h-80">
                  {isImage && file.objectUrl ? (
                    <img
                      src={file.objectUrl}
                      alt={filename}
                      className="max-h-96 max-w-full rounded-xl object-contain shadow-sm"
                    />
                  ) : (
                    <div className="flex max-w-sm flex-col items-center gap-4 py-10 text-center">
                      <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                        {isImage ? (
                          <FileImage className="size-7 text-muted-foreground" />
                        ) : (
                          <FileText className="size-7 text-muted-foreground" />
                        )}
                      </span>
                      <div className="space-y-1">
                        <p className="font-medium">Preview unavailable</p>
                        <p className="text-sm text-muted-foreground">
                          {file.objectUrl
                            ? 'Open the file to view its contents.'
                            : 'This file does not have a preview link.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle>File details</CardTitle>
                <CardDescription>Keep this file easy to recognize in your library.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="filename">File name</Label>
                    <Input
                      className="border-muted-foreground bg-background"
                      id="filename"
                      name="filename"
                      value={form.data.filename}
                      onChange={(event) => form.setData('filename', event.target.value)}
                      aria-invalid={form.errors.filename ? 'true' : undefined}
                      placeholder="Add a file name"
                    />
                    {form.errors.filename && (
                      <p role="alert" className="text-sm text-destructive">
                        {form.errors.filename}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Changing the name does not change the stored file.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">File type</p>
                    <div className="flex h-9 items-center rounded-2xl border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
                      {getFileType(file.filetype)}
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border/70 pt-4">
                    <Button type="submit" disabled={submitting}>
                      <Save />
                      {submitting ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <aside className="flex flex-col gap-6">
            <Card className="border border-border shadow-none">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Indexing status</CardTitle>
                  <ProcessingStatusBadge status={processingStatus} />
                </div>
                <CardDescription>
                  {isProcessing
                    ? 'This file is being prepared for document generation.'
                    : processingStatus === 'ready'
                      ? 'The file is ready to use as source material.'
                      : 'The file could not be prepared for retrieval.'}
                </CardDescription>
              </CardHeader>
              {(file.processingError || file.processingWarnings?.length) && (
                <CardContent className="flex flex-col gap-3 pt-4">
                  {file.processingError && (
                    <p className="break-words rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                      {file.processingError}
                    </p>
                  )}
                  {file.processingWarnings?.map((warning) => (
                    <p key={warning} className="text-xs text-muted-foreground">
                      {warning}
                    </p>
                  ))}
                </CardContent>
              )}
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>Linked documents</CardTitle>
                    <CardDescription>Documents that currently use this file.</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {documents.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {documents.map((document) => (
                      <li key={document.id}>
                        <Link
                          route="documents.edit"
                          routeParams={{ id: document.id }}
                          className="group flex min-w-0 items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <FileText className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium group-hover:underline">
                              {document.title || 'Untitled document'}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <StatusBadge status={document.status} />
                              <span className="text-xs text-muted-foreground">
                                Updated {formatDate(document.updatedAt)}
                              </span>
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No linked documents</p>
                      <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
                        This file has not been added to any documents yet.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link route="documents.index">Browse documents</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle>About this file</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Uploaded</p>
                    <p className="text-sm text-muted-foreground">{formatDate(file.createdAt)}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  {isImage ? (
                    <FileImage className="mt-0.5 size-4 text-muted-foreground" />
                  ) : (
                    <FileText className="mt-0.5 size-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Format</p>
                    <p className="text-sm text-muted-foreground">{getFileType(file.filetype)}</p>
                  </div>
                </div>
                <Separator />
                <div className="min-w-0">
                  <p className="text-sm font-medium">File ID</p>
                  <p
                    className="mt-1 truncate font-mono text-xs text-muted-foreground"
                    title={file.id}
                  >
                    {file.id}
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
