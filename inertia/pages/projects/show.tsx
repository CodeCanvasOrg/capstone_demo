import { Head } from '@inertiajs/react'
import { CaseStudyList } from '@/components/documents/case_study_list'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function Show({
  project,
  documents,
}: {
  project: Data.Project
  documents: Data.Document[]
}) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="page-wrap space-y-8">
      <Head title={project.name} />
      <h1 className="text-3xl font-semibold">{project.name}</h1>
      <p className="text-muted-foreground">{project.description}</p>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Case studies</h2>
        {!!documents.length && <CaseStudyList documents={documents} />}
        {!documents.length && (
          <p className="text-muted-foreground">No case studies in this project yet.</p>
        )}
        <Button asChild>
          <Link route="documents.create" routeParams={{ workspaceId }}>
            New case study
          </Link>
        </Button>
      </section>
      <Form
        route="projects.update"
        routeParams={{ workspaceId, projectId: project.id }}
        className="flex flex-col gap-3 rounded-xl border p-6"
      >
        {({ processing, errors }) => (
          <>
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" name="name" defaultValue={project.name} required />
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              name="description"
              defaultValue={project.description ?? ''}
            />
            {errors.name && <p role="alert">{errors.name}</p>}
            <Button variant="outline" disabled={processing} className="self-start">
              Save project
            </Button>
          </>
        )}
      </Form>
    </div>
  )
}
