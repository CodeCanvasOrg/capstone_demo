import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { type InertiaProps } from '@/types'
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
import { Card, CardContent } from '@/components/ui/card'
import { DocumentForm } from '@/components/documents/form'

export default function Edit({ document }: InertiaProps<{ document: Data.Document }>) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14">
      <Link
        route="documents.index"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to documents
      </Link>

      <div className="mb-6 flex flex-col gap-2">
        <h1 className="font-serif text-3xl">{document.title || 'Untitled document'}</h1>
        <p className="text-sm text-muted-foreground">
          Update the details below and save your changes.
        </p>
      </div>

      <Card>
        <CardContent className="px-5">
          <DocumentForm document={document} />
        </CardContent>
      </Card>

      <AlertDialog>
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
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
  )
}
