import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function Index({ projects }: { projects: Data.Project[] }) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <Head title="Projects" />
      <h1 className="text-3xl font-semibold">Projects</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            route="projects.show"
            routeParams={{ workspaceId, projectId: project.id }}
            className="rounded-xl border bg-card p-6 hover:bg-accent"
          >
            <h2 className="font-semibold">{project.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          </Link>
        ))}
      </div>
      {!projects.length && (
        <p className="text-muted-foreground">
          No projects yet. Create one to group your case studies.
        </p>
      )}
      <Form
        route="projects.store"
        routeParams={{ workspaceId }}
        className="flex flex-col gap-3 rounded-xl border p-6"
      >
        {({ processing, errors }) => (
          <>
            <Label htmlFor="project-name">New project</Label>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={120}
              aria-invalid={!!errors.name}
            />
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input id="project-description" name="description" maxLength={10000} />
            {errors.name && <p role="alert">{errors.name}</p>}
            <Button disabled={processing} className="self-start">
              {processing ? 'Creating…' : 'Create project'}
            </Button>
          </>
        )}
      </Form>
    </div>
  )
}
