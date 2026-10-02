import { Head } from '@inertiajs/react'
import { type Data } from '@generated/data'
import { Form, Link, useRouter } from '@adonisjs/inertia/react'
import { ArrowLeft, CircleAlert, LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect } from 'react'

import ExportDropdown from '@/components/documents/export_dropdown'
import { DocumentMeta } from '@/components/documents/document_meta'
import DocumentEditor from '@/components/documents/editor'
import DocumentShareForm from '@/components/document_shares/form'
import { GenerationStatusBadge } from '@/components/documents/status'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert_dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type InertiaProps } from '@/types'

const EMPTY_DOC = { type: 'doc', content: [] }

export default function Edit({ document }: InertiaProps<{ document: Data.Document }>) {
  const router = useRouter()
  const shares = document.documentShares ?? []
  const versions = document.documentVersions ?? []
  const latestContent = versions[0]?.content ?? EMPTY_DOC
  const generationStatus = document.generationStatus ?? 'ready'
  const isReady = generationStatus === 'ready'
  const isFailed = generationStatus === 'failed'

  useEffect(() => {
    if (isReady || isFailed) return

    const interval = setInterval(() => {
      router.visit(
        { href: window.location.href },
        { only: ['document'], preserveScroll: true, preserveState: true }
      )
    }, 2500)

    return () => clearInterval(interval)
  }, [generationStatus, isFailed, isReady, router])

  return (
    <div className="min-h-screen">
      <Head title={document.title || 'Untitled document'} />
      <header className="sm:sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-2 px-4 py-2 md:px-10">
          <Link
            route="documents.index"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to documents
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {isReady && <ExportDropdown document={document} />}
            <DocumentShareForm document={document} shares={shares} />
          </div>
        </div>
      </header>

      <div className="w-full">
        <div className="border-b border-border/60 bg-secondary/30">
          <DocumentMeta document={document} />
        </div>

        {isReady ? (
          <DocumentEditor documentId={document.id} initialContent={latestContent} />
        ) : (
          <Card role="status" aria-live="polite" className="mx-auto my-12 w-[min(100%-2rem,56rem)]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  {isFailed ? (
                    <CircleAlert className="size-4" />
                  ) : (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    {isFailed ? 'Document preparation failed' : 'Preparing your document'}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isFailed
                      ? 'The source files could not be processed. Their status is saved so the failure can be diagnosed.'
                      : 'Indexing your source files and drafting the document. This page updates automatically.'}
                  </CardDescription>
                </div>
                <GenerationStatusBadge status={generationStatus} />
              </div>
            </CardHeader>
            {isFailed && document.generationError && (
              <CardContent>
                <p
                  role="alert"
                  className="break-words rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {document.generationError}
                </p>
              </CardContent>
            )}
          </Card>
        )}

        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 md:px-10">
          <AlertDialog>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <div className="flex flex-col gap-1">
                <h2 className="font-medium">Delete document</h2>
                <p className="text-sm text-muted-foreground">
                  Permanently remove “{document.title || 'Untitled document'}”.
                </p>
              </div>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 />
                  Delete
                </Button>
              </AlertDialogTrigger>
            </div>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{document.title || 'Untitled document'}” will be permanently deleted. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button variant="outline">Cancel</Button>
                </AlertDialogCancel>
                <Form route="documents.destroy" routeParams={{ id: document.id }}>
                  {({ processing }) => (
                    <Button type="submit" variant="destructive" disabled={processing}>
                      {processing ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
