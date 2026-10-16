import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { ArrowUpRight, Plus, Folder, FileText, Users } from 'lucide-react'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageIntro } from '@/components/page_intro'
import { CaseStudyList } from '@/components/documents/case_study_list'
import { EmptyState } from '@/components/empty_state'
export default function Home({
  documents,
  projects,
}: {
  documents: Data.Document[]
  projects: Data.Project[]
}) {
  const { workspace, workspaceCapabilities } = useWorkspace()
  if (!workspace) return null
  const workspaceId = workspace.id
  return (
    <div className="page-wrap space-y-10">
      <Head title={workspace.name} />
      <PageIntro
        eyebrow="Workspace home"
        title={workspace.name}
        description="A shared place to turn project work into stories worth telling."
        action={
          <Button asChild>
            <Link route="documents.create" routeParams={{ workspaceId }}>
              <Plus />
              New case study
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            route: 'documents.index' as const,
            label: 'Case studies',
            description: 'Write, refine, and review',
            Icon: FileText,
          },
          {
            route: 'files.index' as const,
            label: 'Shared files',
            description: 'The evidence behind the story',
            Icon: Folder,
          },
          {
            route: 'workspace_members.index' as const,
            label: 'Your team',
            description: 'People in this workspace',
            Icon: Users,
          },
        ].map(({ route, label, description, Icon }) => (
          <Link
            key={route}
            route={route}
            routeParams={{ workspaceId }}
            className="group rounded-xl border bg-sidebar p-5 hover:bg-accent"
          >
            <div className="mb-5 flex justify-between">
              <Icon className="size-5" />
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
            </div>
            <h2 className="font-semibold">{label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Pick up where you left off</h2>
          <Link
            route="documents.index"
            routeParams={{ workspaceId }}
            className="text-xs underline underline-offset-4"
          >
            All case studies
          </Link>
        </div>
        {documents.length ? (
          <CaseStudyList documents={documents} />
        ) : (
          <EmptyState
            title="Your first story starts here"
            description="Add a case study, gather the project details, and connect its evidence."
            action={
              <Button asChild>
                <Link route="documents.create" routeParams={{ workspaceId }}>
                  Create case study
                  <Plus />
                </Link>
              </Button>
            }
          />
        )}
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Link
            route="projects.index"
            routeParams={{ workspaceId }}
            className="text-xs underline underline-offset-4"
          >
            Manage projects
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              route="projects.show"
              routeParams={{ workspaceId, projectId: project.id }}
              className="rounded-xl border bg-sidebar p-5 hover:bg-accent"
            >
              <Folder className="mb-4 size-5 text-muted-foreground" />
              <h3 className="break-words font-semibold">{project.name}</h3>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {project.description || 'Related case studies, kept together.'}
              </p>
            </Link>
          ))}
        </div>
        {!projects.length && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Create a project to group related case studies. You can also keep them ungrouped.
          </p>
        )}
      </section>
      {workspaceCapabilities?.manageMembers && (
        <section className="rounded-xl border bg-sidebar p-5">
          <Form
            route="workspaces.update"
            routeParams={{ workspaceId }}
            className="flex flex-wrap items-end gap-3"
          >
            {({ processing, errors }) => (
              <>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="rename-workspace">Workspace name</Label>
                  <Input
                    id="rename-workspace"
                    name="name"
                    defaultValue={workspace.name}
                    required
                    maxLength={120}
                  />
                  {errors.name && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>
                <Button variant="outline" disabled={processing}>
                  Save name
                </Button>
              </>
            )}
          </Form>
        </section>
      )}
    </div>
  )
}
