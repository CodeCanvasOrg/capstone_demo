import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'
import { Reveal } from '@/components/reveal'
import { type Data } from '@generated/data'
import { Link, useRouter } from '@adonisjs/inertia/react'
import { FileText, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { type InertiaProps } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import FileIndexCard from '@/components/files/index_card'

export default function Index({ files }: InertiaProps<{ files: Data.File[] }>) {
  const router = useRouter()
  const hasPendingProcessing = files.some(
    (file) => file.processingStatus === 'uploaded' || file.processingStatus === 'processing'
  )

  useEffect(() => {
    if (!hasPendingProcessing) return

    const interval = setInterval(() => {
      router.visit(
        { href: window.location.href },
        { only: ['files'], preserveScroll: true, preserveState: true }
      )
    }, 2500)

    return () => clearInterval(interval)
  }, [hasPendingProcessing, router])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14">
      <Head title="Files" />
      <PageIntro
        eyebrow="Your source library"
        title="Files"
        description="Keep the documents, notes, and images behind your next story together."
        action={
          <Button asChild>
            <Link route="files.create">
              <Plus />
              Upload files
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-medium">
          All files{' '}
          <span className="ml-2 border border-border bg-card px-2 py-0.5 text-xs">
            {files.length}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">Source material for your documents.</p>
      </div>
      <Reveal>
        {files.length === 0 ? (
          <Card className="border border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center border border-border bg-secondary text-secondary-foreground">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl">No files found</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Upload your first file to get started.
                </p>
              </div>
              <Button asChild>
                <Link route="files.create">
                  <Plus />
                  Upload files
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
                    <TableHead className="pl-5">File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Indexing</TableHead>
                    <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody role="rowgroup">
                  {files.map((file) => (
                    <FileIndexCard key={file.id} file={file} />
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
