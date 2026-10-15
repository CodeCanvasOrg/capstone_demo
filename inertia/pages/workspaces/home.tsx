import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
export default function Home({
  documents,
  projects,
}: {
  documents: Data.Document[]
  projects: Data.Project[]
}) {
  const { workspace } = useWorkspace()
  if (!workspace) return null
  const workspaceId = workspace.id
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
      <Head title={workspace.name} />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Workspace home
          </p>
          <h1 className="text-3xl font-semibold">{workspace.name}</h1>
        </div>
        <Button asChild>
          <Link route="documents.create" routeParams={{ workspaceId }}>
            New case study
          </Link>
        </Button>
      </header>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent case studies</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => (
            <Link
              key={document.id}
              route="documents.edit"
              routeParams={{ workspaceId, id: document.id }}
              className="rounded-xl border bg-card p-6 hover:bg-accent"
            >
              <p className="mb-3 text-xs uppercase text-muted-foreground">
                {document.status?.replaceAll('_', ' ')}
              </p>
              <h3 className="font-semibold">{document.title}</h3>
              <p className="mt-3 truncate text-sm text-muted-foreground">
                {document.user?.fullName || document.user?.email}
              </p>
            </Link>
          ))}
        </div>
        {!documents.length && (
          <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Create your first case study to bring project work and evidence together.
          </p>
        )}
      </section>
      <section>
        <div className="mb-4 flex justify-between">
          <h2 className="text-xl font-semibold">Projects</h2>
          <Link route="projects.index" routeParams={{ workspaceId }} className="text-sm underline">
            View projects
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              route="projects.show"
              routeParams={{ workspaceId, projectId: project.id }}
              className="rounded-lg border p-4 hover:bg-accent"
            >
              {project.name}
            </Link>
          ))}
        </div>
        {!projects.length && (
          <p className="text-sm text-muted-foreground">
            Projects group related case studies. Ungrouped case studies remain available.
          </p>
        )}
      </section>
    </div>
  )
}
