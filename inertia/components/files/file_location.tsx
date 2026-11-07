import { useState } from 'react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { FolderOpen, Plus, X } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/icon_button'

/** Lists a file's projects and lets its owner link or unlink them. */
export function FileLocation({ file, projects }: { file: Data.File; projects: Data.Project[] }) {
  const workspaceId = useWorkspaceId()
  const linked = file.projects ?? []
  const unlinked = projects.filter((project) => !linked.some((item) => item.id === project.id))
  const [projectId, setProjectId] = useState('')
  const canManage = file.capabilities.manageProjects
  return (
    <section className="space-y-4 rounded-xl border bg-sidebar p-5">
      <h2 className="eyebrow">Location</h2>
      {linked.length ? (
        <ul className="space-y-2">
          {linked.map((project) => (
            <li key={project.id} className="flex items-center gap-2">
              <FolderOpen aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <Link
                route="projects.show"
                routeParams={{ workspaceId, projectId: project.id }}
                className="min-w-0 flex-1 truncate text-xs underline underline-offset-4"
                title={project.name}
              >
                {project.name}
              </Link>
              {canManage && (
                <Form
                  route="fileProjects.destroy"
                  routeParams={{ workspaceId, id: file.id, projectId: project.id }}
                  options={{ preserveScroll: true }}
                >
                  {({ processing }) => (
                    <IconButton
                      icon={X}
                      label={`Remove from ${project.name}`}
                      type="submit"
                      disabled={processing}
                      className="size-7"
                    />
                  )}
                </Form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Workspace library. Every case study can use this file.
        </p>
      )}
      {canManage && unlinked.length > 0 && (
        <Form
          route="fileProjects.store"
          routeParams={{ workspaceId, id: file.id }}
          options={{ preserveScroll: true }}
          onSuccess={() => setProjectId('')}
          className="flex items-center gap-2"
        >
          {({ processing }) => (
            <>
              <label htmlFor="file-project" className="sr-only">
                Project
              </label>
              <select
                id="file-project"
                name="projectId"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="form-select min-w-0 flex-1"
              >
                <option value="">Choose a project</option>
                {unlinked.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={processing || !projectId}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </>
          )}
        </Form>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {canManage
          ? 'Files linked to projects are only offered to those projects. Remove every project to return a file to the workspace library.'
          : 'Only the owner can change where this file is offered.'}
      </p>
    </section>
  )
}
