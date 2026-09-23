import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentForm } from '@/components/documents/form'

export default function Create() {
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
        <h1 className="font-serif text-3xl">New document</h1>
        <p className="text-sm text-muted-foreground">
          Give your document a title, description and status to get started.
        </p>
      </div>

      <Card>
        <CardContent className="px-5">
          <DocumentForm />
        </CardContent>
      </Card>
    </div>
  )
}
