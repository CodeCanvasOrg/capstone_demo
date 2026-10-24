import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Plus, Folder, Settings2, ArrowRight, Save, FilePlus2 } from 'lucide-react'
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
    <div className="minimal-page max-w-5xl space-y-12">
      <Head title={workspace.name} />
      <header className="flex items-center justify-between gap-4">
        <h1 className="truncate text-lg font-semibold">{workspace.name}</h1>
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
        route="documents.create"
        routeParams={{ workspaceId }}
        className="group flex items-center justify-between rounded-xl border bg-muted/20 px-5 py-6 transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-3 text-base font-medium tracking-tight">
          <FilePlus2 aria-hidden="true" className="size-5" />
          New case study
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <ArrowRight className="size-4" />
        </span>
      </Link>
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Recent case studies</h2>
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
          <div className="border-y py-12 text-center">
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
          <h2 className="text-sm font-medium">Projects</h2>
          <ProjectDialog />
        </div>
        <div className="divide-y border-y">
          {projects.map((project) => (
            <Link
              key={project.id}
              route="projects.show"
              routeParams={{ workspaceId, projectId: project.id }}
              className="flex items-center gap-3 px-2 py-4 text-sm hover:bg-muted/40"
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
