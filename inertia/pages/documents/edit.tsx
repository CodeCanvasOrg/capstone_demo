import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Trash2 } from 'lucide-react'

import { DocumentMeta } from '@/components/documents/document_meta'
import DocumentEditor from '@/components/documents/editor'
import DocumentShareForm from '@/components/document_shares/form'
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
import { type InertiaProps } from '@/types'

const EMPTY_DOC = { type: 'doc', content: [] }

export default function Edit({ document }: InertiaProps<{ document: Data.Document }>) {
  const shares = document.documentShares ?? []
  const versions = document.documentVersions ?? []
  const latestContent = versions[0]?.content ?? EMPTY_DOC

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-14 w-full items-center gap-2 px-4 md:px-10">
          <Link
            route="documents.index"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to documents
          </Link>
          <div className="ml-auto">
            <DocumentShareForm document={document} shares={shares} />
          </div>
        </div>
      </header>

      <main className="w-full">
        <div className="border-b border-border/60">
          <DocumentMeta document={document} />
        </div>

        <DocumentEditor documentId={document.id} initialContent={latestContent} />

        <div className="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-10 md:px-10">
          <AlertDialog>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
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
                  <Button type="submit" variant="destructive">
                    Delete
                  </Button>
                </Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  )
}
