import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Plus, Folder, Settings2, ArrowRight, Save, FilePlus2 } from 'lucide-react'
import { Bee } from '@/components/bee/bee'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CaseStudyList } from '@/components/documents/case_study_list'
import { ProjectDialog } from '@/components/projects_dialog'
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
    <div className="minimal-page max-w-5xl space-y-10">
      <Head title={workspace.name} />
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Workspace</p>
          <h1 className="truncate text-2xl font-semibold">{workspace.name}</h1>
        </div>
        {workspaceCapabilities?.manageMembers && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Workspace settings">
                <Settings2 className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Workspace settings</DialogTitle>
                <DialogDescription>Update the name your team sees.</DialogDescription>
              </DialogHeader>
              <Form route="workspaces.update" routeParams={{ workspaceId }} className="space-y-4">
                {({ processing, errors }) => (
                  <>
                    <Label htmlFor="rename-workspace">Workspace name</Label>
                    <Input
                      id="rename-workspace"
                      aria-describedby={errors.name ? 'rename-workspace-error' : undefined}
                      name="name"
                      aria-invalid={!!errors.name}
                      disabled={processing}
                      defaultValue={workspace.name}
                      required
                      maxLength={120}
                    />
                    {errors.name && (
                      <p
                        id="rename-workspace-error"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {errors.name}
                      </p>
                    )}
                    <Button disabled={processing}>
                      <Save aria-hidden="true" />
                      {processing ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                )}
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </header>
      <Link
        data-tour="new"
        route="documents.create"
        routeParams={{ workspaceId }}
        className="cta-card group"
      >
        <span className="relative z-10">
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <FilePlus2 aria-hidden="true" className="size-5" />
            New case study
          </span>
          <span className="mt-1 block max-w-sm text-sm leading-6 opacity-70">
            Start from a template or a few rough notes. We’ll shape the story together.
          </span>
        </span>
        <span className="relative z-10 flex items-center gap-4">
          <Bee className="cta-bee hidden size-16 sm:block" />
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </span>
      </Link>
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent case studies</h2>
          <Button asChild variant="ghost" size="sm">
            <Link route="documents.index" routeParams={{ workspaceId }}>
              <ArrowRight aria-hidden="true" className="size-3" />
              All
            </Link>
          </Button>
        </div>
        {documents.length ? (
          <CaseStudyList documents={documents} />
        ) : (
          <div className="rounded-2xl border border-dashed bg-card/60 py-12 text-center">
            <p className="text-sm text-muted-foreground">No case studies yet.</p>
            <Button asChild variant="ghost" size="sm" className="mt-3">
              <Link route="documents.create" routeParams={{ workspaceId }}>
                <Plus className="size-3.5" />
                New case study
              </Link>
            </Button>
          </div>
        )}
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Projects</h2>
          <ProjectDialog />
        </div>
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {projects.map((project) => (
            <Link
              key={project.id}
              route="projects.show"
              routeParams={{ workspaceId, projectId: project.id }}
              className="flex items-center gap-3 px-5 py-4 text-sm transition-colors hover:bg-accent"
            >
              <Folder className="size-4 text-muted-foreground" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
          {!projects.length && (
            <p className="py-8 text-center text-xs text-muted-foreground">No projects yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
