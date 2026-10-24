import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { FolderOpen, ChevronRight } from 'lucide-react'
import {
  CollectionSearch,
  PaginationControls,
  type Pagination,
} from '@/components/collection_controls'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { ProjectDialog } from '@/components/projects_dialog'
export default function Index({
  projects,
  pagination,
  filters = { q: '' },
}: {
  projects: Data.Project[]
  pagination?: Pagination
  filters?: { q: string }
}) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="minimal-page">
      <Head title="Projects" />
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Projects</h1>
        <ProjectDialog />
      </header>
      <div className="mt-8 max-w-sm">
        <CollectionSearch collection="projects" q={filters.q} />
      </div>
      <div className="mt-6 divide-y border-y">
        {projects.map((project) => (
          <Link
            key={project.id}
            route="projects.show"
            routeParams={{ workspaceId, projectId: project.id }}
            className="group flex items-center gap-4 px-2 py-5 transition-colors hover:bg-muted/50"
          >
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">{project.name}</h2>
              {project.description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{project.description}</p>
              )}
            </div>
            <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
        {!projects.length && (
          <div className="py-20 text-center">
            <FolderOpen className="mx-auto mb-4 size-6 text-muted-foreground" />
            <p className="text-sm">{filters.q ? 'No matching projects' : 'No projects yet'}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {filters.q ? 'Try a different search.' : 'Group related case studies.'}
            </p>
          </div>
        )}
      </div>
      <PaginationControls pagination={pagination} collection="projects" query={filters} />
    </div>
  )
}
