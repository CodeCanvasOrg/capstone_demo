import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Plus, Folder, Settings2, ArrowRight, Save, FilePlus2 } from 'lucide-react'
import { Ribbons } from '@/components/ribbons'
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
      <section className="hero-band">
        <Ribbons
          seed={workspace.name}
          width={420}
          height={200}
          lines={40}
          step={6}
          weight={0.5}
          className="ribbons-art"
        />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span aria-hidden="true" className="page-bar" />
            <p className="eyebrow mb-1.5">Workspace</p>
            <h1 className="page-title truncate">{workspace.name}</h1>
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
        </div>
        <p className="mt-4 max-w-md text-sm leading-6">
          Start from a template or a few rough notes. We’ll shape the story together.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link data-tour="new" route="documents.create" routeParams={{ workspaceId }}>
            <FilePlus2 aria-hidden="true" />
            New case study
          </Link>
        </Button>
      </section>
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
