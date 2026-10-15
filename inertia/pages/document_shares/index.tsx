import { useWorkspaceId } from '@/providers/workspace_provider'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { FileText, Plus } from 'lucide-react'
import { type InertiaProps } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DocumentCard from '@/components/documents/document_card'

export default function Index({ documents }: InertiaProps<{ documents: Data.Document[] }>) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl">Documents Shared with Me</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length === 0
              ? 'No documents shared yet'
              : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`}
          </p>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center border border-border">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">No documents found</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Wait until they share a document with you. In the meantime you can create a
                document!
              </p>
            </div>
            <Button asChild>
              <Link route="documents.create" routeParams={{ workspaceId }}>
                <Plus />
                Create document
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Updated</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
