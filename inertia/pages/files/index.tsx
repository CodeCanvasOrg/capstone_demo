import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { useEffect } from 'react'
import { FileText, Plus, ArrowUpRight } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { PageIntro } from '@/components/page_intro'
import { Button } from '@/components/ui/button'
import { ProcessingStatusBadge } from '@/components/documents/status'
import {
  CollectionSearch,
  PaginationControls,
  type Pagination,
} from '@/components/collection_controls'
import { EmptyState } from '@/components/empty_state'
export default function Index({
  files,
  pagination,
  filters = { q: '' },
}: {
  files: Data.File[]
  pagination?: Pagination
  filters?: { q: string }
}) {
  const workspaceId = useWorkspaceId()
  const processing = files.some((file) =>
    ['uploaded', 'queued', 'processing'].includes(file.processingStatus ?? '')
  )
  useEffect(() => {
    if (!processing) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.reload({ only: ['files'] })
    }, 2500)
    return () => clearInterval(interval)
  }, [processing])
  return (
    <div className="page-wrap">
      <Head title="Shared files" />
      <PageIntro
        eyebrow="Workspace / Evidence"
        title="The source of your stories."
        description="One shared library for the documents, notes, and images behind your work."
        action={
          <Button asChild>
            <Link route="files.create" routeParams={{ workspaceId }}>
              <Plus />
              Upload files
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="min-w-60 flex-1">
          <CollectionSearch collection="files" q={filters.q} />
        </div>
        <p className="text-xs text-muted-foreground">
          {pagination?.total ?? files.length} files · Shared with your team
        </p>
      </div>
      {files.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-sidebar">
          {files.map((file) => (
            <li key={file.id}>
              <Link
                route="files.edit"
                routeParams={{ workspaceId, id: file.id }}
                className="flex items-center gap-4 p-5 hover:bg-accent"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{file.filename}</span>
                  <span className="mt-1 block text-[.625rem] text-muted-foreground">
                    {file.filetype?.replace('.', '').toUpperCase()} ·{' '}
                    {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}
                  </span>
                </span>
                <ProcessingStatusBadge status={file.processingStatus} />
                <ArrowUpRight className="hidden size-4 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={filters.q ? 'No matching files' : 'Give the story its evidence'}
          description={
            filters.q
              ? 'Try a different file name.'
              : 'Upload project files once and use them across your workspace’s case studies.'
          }
          action={
            <Button asChild>
              <Link route="files.create" routeParams={{ workspaceId }}>
                Upload files
              </Link>
            </Button>
          }
        />
      )}
      <PaginationControls pagination={pagination} collection="files" query={filters} />
    </div>
  )
}
