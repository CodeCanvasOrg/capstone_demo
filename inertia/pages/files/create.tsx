import { useState } from 'react'
import type { Data } from '@generated/data'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'
import { Reveal } from '@/components/reveal'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import UserForm from '@/components/files/user_form'

export default function Create({
  projects = [],
  initialProjectId = null,
}: {
  projects?: Data.Project[]
  initialProjectId?: string | null
}) {
  const workspaceId = useWorkspaceId()
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  return (
    <div className="page-wrap max-w-3xl">
      <Link
        route="files.index"
        routeParams={{ workspaceId }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Files
      </Link>

      <Head title="Upload files" />
      <PageIntro title="Upload files" />

      <Reveal>
        <Card className="border bg-sidebar py-7">
          <CardContent className="space-y-5 px-5">
            {projects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="upload-project">Save to</Label>
                <select
                  id="upload-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="form-select max-w-xs"
                >
                  <option value="">Workspace library</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {projectId
                    ? "Only this project's case studies can use these files."
                    : 'Every case study in the workspace can use these files.'}
                </p>
              </div>
            )}
            <UserForm projectId={projectId || null} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}
