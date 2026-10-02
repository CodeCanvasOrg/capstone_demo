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
      router.visit({ href: window.location.href }, { only: ['files'], preserveScroll: true })
    }, 2500)

    return () => clearInterval(interval)
  }, [hasPendingProcessing, router])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl">Files</h1>
          <p className="text-sm text-muted-foreground">
            {files.length === 0
              ? 'No files yet'
              : `${files.length} ${files.length === 1 ? 'file' : 'files'}`}
          </p>
        </div>
        <Button asChild>
          <Link route="files.create">
            <Plus />
            Upload files
          </Link>
        </Button>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center border border-border">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">No files found</h2>
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
        <Card>
          <CardContent className="px-0 py-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Indexing</TableHead>
                  <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <FileIndexCard key={file.id} file={file} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
