import { Head, router } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { useEffect, useState } from 'react'
import { Download, FileText, Save, AlertTriangle } from 'lucide-react'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { PageIntro } from '@/components/page_intro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProcessingStatusBadge } from '@/components/documents/status'
import { Disclosure } from '@/components/disclosure'
import { safeMessage } from '@/lib/api'
import { ConfirmAction } from '@/components/confirm_action'
export default function Edit({ file }: { file: Data.File }) {
  const workspaceId = useWorkspaceId()
  const [filename, setFilename] = useState(file.filename ?? '')
  const processing = ['uploaded', 'queued', 'processing'].includes(file.processingStatus ?? '')
  useUnsavedChanges('file-name', file.capabilities.rename && filename !== file.filename)
  useEffect(() => {
    if (!processing) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.reload({ only: ['file'] })
    }, 2500)
    return () => clearInterval(interval)
  }, [processing])
  return (
    <div className="page-wrap">
      <Head title={file.filename ?? 'File details'} />
      <PageIntro
        title={file.filename ?? 'Untitled file'}
        action={
          <Button asChild variant="outline">
            <a href={file.downloadUrl ?? '#'}>
              <Download />
              Download
            </a>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border bg-sidebar">
            <div className="border-b p-5">
              <h2 className="text-sm font-semibold">Original file</h2>
            </div>
            <div className="flex min-h-72 items-center justify-center bg-muted/30 p-6">
              {file.filetype &&
              ['.png', '.jpg', '.jpeg'].includes(file.filetype) &&
              file.downloadUrl ? (
                <img
                  src={file.downloadUrl}
                  alt={file.filename ?? 'Source image'}
                  className="max-h-96 max-w-full rounded-xl object-contain"
                />
              ) : (
                <div className="space-y-3 text-center">
                  <FileText className="mx-auto size-10 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {file.filetype?.replace('.', '').toUpperCase()} source file
                  </p>
                  <p className="text-xs text-muted-foreground">Download to view.</p>
                </div>
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-sidebar p-5">
            <Form
              route="files.update"
              routeParams={{ workspaceId, id: file.id }}
              className="space-y-4"
            >
              {({ processing: saving, errors }) => (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="filename">File name</Label>
                    <Input
                      id="filename"
                      name="filename"
                      value={filename}
                      onChange={(event) => setFilename(event.target.value)}
                      required
                      maxLength={255}
                      disabled={!file.capabilities.rename}
                      aria-invalid={!!errors.filename}
                      aria-describedby={errors.filename ? 'filename-error' : undefined}
                    />
                    {errors.filename && (
                      <p id="filename-error" role="alert" className="text-sm text-destructive">
                        {errors.filename}
                      </p>
                    )}
                  </div>
                  {file.capabilities.rename ? (
                    <Button disabled={saving || filename === file.filename}>
                      <Save aria-hidden="true" />
                      Save
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Only the owner can rename or delete.
                    </p>
                  )}
                </>
              )}
            </Form>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-sidebar p-5">
            <h2 className="eyebrow">File status</h2>
            <ProcessingStatusBadge status={file.processingStatus} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {processing
                ? 'Preparing your file…'
                : file.processingStatus === 'ready'
                  ? 'Ready to use in case studies.'
                  : 'This file needs attention before use.'}
            </p>
            {file.processingError && (
              <p role="alert" className="text-xs text-destructive">
                {safeMessage(
                  file.processingError,
                  'This file could not be prepared. Try again or upload another file.'
                )}
              </p>
            )}
            {file.processingWarnings.length > 0 && (
              <Disclosure
                icon={AlertTriangle}
                title="File warnings"
                summary={file.processingWarnings.length}
              >
                {file.processingWarnings.map((warning) => (
                  <p key={warning} className="text-xs text-muted-foreground">
                    {warning}
                  </p>
                ))}
              </Disclosure>
            )}
            {file.capabilities.rename &&
              ['failed', 'outdated'].includes(file.processingStatus ?? '') && (
                <Form route="files.retry" routeParams={{ workspaceId, id: file.id }}>
                  {({ processing: retrying }) => (
                    <>
                      <input type="hidden" name="mutationId" value={crypto.randomUUID()} />
                      <input type="hidden" name="baseVersionId" value="" />
                      <Button variant="outline" size="sm" disabled={retrying}>
                        {retrying
                          ? 'Preparing…'
                          : file.processingStatus === 'outdated'
                            ? 'Prepare again'
                            : 'Try again'}
                      </Button>
                    </>
                  )}
                </Form>
              )}
          </section>
          <section className="space-y-4 rounded-xl border bg-sidebar p-5">
            <h2 className="eyebrow">Used in case studies</h2>
            {file.documents?.length ? (
              <ul className="space-y-3">
                {file.documents.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      route="documents.edit"
                      routeParams={{ workspaceId, id: doc.id }}
                      className="block break-words text-xs underline underline-offset-4"
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                This file is not linked to a case study yet.
              </p>
            )}
          </section>
          {file.capabilities.delete && (
            <section className="rounded-xl border bg-sidebar p-5">
              <ConfirmAction
                trigger="Delete file"
                title="Delete this shared file?"
                description={`This file supports ${file.documents?.length ?? 0} case studies. Deleting it removes its evidence and invalidates affected reviews and approvals. This cannot be undone.`}
              >
                <Form route="files.destroy" routeParams={{ workspaceId, id: file.id }}>
                  <Button variant="destructive">Delete file</Button>
                </Form>
              </ConfirmAction>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
