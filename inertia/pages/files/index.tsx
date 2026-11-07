import { Head, router } from '@inertiajs/react'
import { Link, useRouter } from '@adonisjs/inertia/react'
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
import { ProjectBadges } from '@/components/files/project_badges'
export default function Index({
  files,
  pagination,
  projects = [],
  filters = { q: '', scope: 'all' },
}: {
  files: Data.File[]
  pagination?: Pagination
  projects?: Data.Project[]
  filters?: { q: string; scope?: string }
}) {
  const scope = filters.scope ?? 'all'
  const navigate = useRouter()
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
        title="Files"
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
          <CollectionSearch collection="files" q={filters.q} scope={scope} />
        </div>
        {projects.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="scope-filter" className="text-xs font-medium">
              Location
            </label>
            <select
              id="scope-filter"
              className="form-select max-w-64"
              value={scope}
              onChange={(event) =>
                navigate.visit(
                  { route: 'files.index', routeParams: { workspaceId } },
                  { data: { q: filters.q, scope: event.target.value }, preserveScroll: true }
                )
              }
            >
              <option value="all">All files</option>
              <option value="workspace">Workspace library</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{pagination?.total ?? files.length} files</p>
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
                <ProjectBadges projects={file.projects} />
                <ProcessingStatusBadge status={file.processingStatus} />
                <ArrowUpRight className="hidden size-4 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={filters.q || scope !== 'all' ? 'No matching files' : 'No files yet'}
          description={
            filters.q || scope !== 'all'
              ? 'Try a different file name or location.'
              : 'Add files to use as sources.'
          }
          action={
            <Button asChild>
              <Link route="files.create" routeParams={{ workspaceId }}>
                <Plus aria-hidden="true" />
                Upload files
              </Link>
            </Button>
          }
        />
      )}
      <PaginationControls
        pagination={pagination}
        collection="files"
        query={{ q: filters.q, scope }}
      />
    </div>
  )
}
