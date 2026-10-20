import { Head } from '@inertiajs/react'
import { Link, useRouter } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Plus } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { PageIntro } from '@/components/page_intro'
import { Button } from '@/components/ui/button'
import { CaseStudyList } from '@/components/documents/case_study_list'
import {
  CollectionSearch,
  PaginationControls,
  type Pagination,
} from '@/components/collection_controls'
import { EmptyState } from '@/components/empty_state'
export default function Index({
  documents,
  pagination,
  projects = [],
  filters = { q: '', status: '', project: '' },
}: {
  projects?: Data.Project[]
  documents: Data.Document[]
  pagination?: Pagination
  filters?: { q: string; status?: string; project?: string }
}) {
  const workspaceId = useWorkspaceId()
  const router = useRouter()
  const action = (
    <Button asChild>
      <Link route="documents.create" routeParams={{ workspaceId }}>
        <Plus />
        New case study
      </Link>
    </Button>
  )
  return (
    <div className="page-wrap">
      <Head title="Case studies" />
      <PageIntro
        eyebrow="Shared knowledge"
        title="All case studies"
        description="From a first idea to a story ready to share. Everyone in this workspace can contribute."
        action={action}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Case study status" className="flex flex-wrap gap-1">
          {[
            ['', 'All'],
            ['draft', 'Drafts'],
            ['edited', 'Edited'],
            ['in_review', 'In review'],
            ['approved', 'Approved'],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filters.status === value ? 'secondary' : 'ghost'}
              size="sm"
              asChild
            >
              <Link
                href={`/workspaces/${workspaceId}/documents?${new URLSearchParams({ q: filters.q, status: value, project: filters.project ?? '' })}`}
                aria-current={filters.status === value ? 'page' : undefined}
              >
                {label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="w-full max-w-sm">
          <CollectionSearch collection="documents" {...filters} />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="project-filter" className="text-xs font-medium">
          Project
        </label>
        <select
          id="project-filter"
          className="form-select max-w-64"
          value={filters.project ?? ''}
          onChange={(event) =>
            router.visit(
              { route: 'documents.index', routeParams: { workspaceId } },
              {
                data: { q: filters.q, status: filters.status ?? '', project: event.target.value },
                preserveScroll: true,
              }
            )
          }
        >
          <option value="">All projects</option>
          <option value="ungrouped">Ungrouped</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {(filters.q || filters.status || filters.project) && (
          <Link route="documents.index" routeParams={{ workspaceId }} className="text-xs underline">
            Clear filters
          </Link>
        )}
      </div>
      <p aria-live="polite" className="mb-3 text-xs text-muted-foreground">
        {pagination?.total ?? documents.length} case studies
        {filters.project === 'ungrouped' ? ' · Ungrouped' : ''}
      </p>
      {documents.length ? (
        <CaseStudyList documents={documents} />
      ) : (
        <EmptyState
          title={filters.q ? 'No matching case studies' : 'Your next story starts here'}
          description={
            filters.q
              ? 'Try another search or clear the filters.'
              : 'Create a case study, add the project context, and bring in the sources that support your story.'
          }
          action={action}
        />
      )}
      <PaginationControls
        pagination={pagination}
        collection="documents"
        query={{ q: filters.q, status: filters.status ?? '', project: filters.project ?? '' }}
      />
    </div>
  )
}
