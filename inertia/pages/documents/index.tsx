import { useWorkspaceId } from '@/providers/workspace_provider'
import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'
import { Reveal } from '@/components/reveal'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { FileText, Plus } from 'lucide-react'
import { type InertiaProps } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DocumentCard from '@/components/documents/document_card'

export default function Index({
  documents,
}: InertiaProps<{
  documents: Data.Document[]
  pagination?: { total: number; currentPage: number; lastPage: number; perPage: number }
  filters?: { q: string; status?: string; project?: string }
}>) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14">
      <Head title="Documents" />
      <PageIntro
        eyebrow="Your workspace"
        title="Documents"
        description="Shape your ideas into documents you can refine and share."
        action={
          <Button asChild>
            <Link route="documents.create" routeParams={{ workspaceId }}>
              <Plus />
              New document
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-medium">
          All documents{' '}
          <span className="ml-2 border border-border bg-card px-2 py-0.5 text-xs">
            {documents.length}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">Your drafts, in one place.</p>
      </div>
      <Reveal>
        {documents.length === 0 ? (
          <Card className="border border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center border border-border bg-secondary text-secondary-foreground">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl">No documents found</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Create your first document to get started.
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
          <Card className="border border-border shadow-none">
            <CardContent className="px-0 py-1">
              <Table role="table" className="workspace-table">
                <TableHeader role="rowgroup">
                  <TableRow role="row">
                    <TableHead className="pl-5">Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Updated</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody role="rowgroup">
                  {documents.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Reveal>
    </div>
  )
}
