import { FolderOpen, Plus } from 'lucide-react'
import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function Index() {
  const { workspaces } = useWorkspace()
  return (
    <div className="page-wrap max-w-3xl">
      <Head title="Your workspaces" />
      <h1 className="page-title mb-3 text-3xl">Workspaces</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            route="workspaces.show"
            routeParams={{ workspaceId: workspace.id }}
            className="flex items-center gap-3 rounded-xl border bg-sidebar p-6 font-medium hover:bg-accent"
          >
            <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{workspace.name}</span>
          </Link>
        ))}
      </div>
      {workspaces.length === 0 && (
        <p className="mb-6 rounded-lg border p-4">Create a workspace or accept an invitation.</p>
      )}
      <Form route="workspaces.store" className="mt-8 flex flex-col gap-3 rounded-xl border p-6">
        {({ processing, errors }) => (
          <>
            <Label htmlFor="workspace-name">Create workspace</Label>
            <Input
              id="workspace-name"
              aria-describedby={errors.name ? 'workspace-name-error' : undefined}
              name="name"
              maxLength={120}
              required
              placeholder="Workspace name"
              aria-invalid={!!errors.name}
              disabled={processing}
            />
            {errors.name && (
              <p id="workspace-name-error" role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
            <Button className="self-start" disabled={processing}>
              <Plus aria-hidden="true" />
              {processing ? 'Creating…' : 'Create workspace'}
            </Button>
          </>
        )}
      </Form>
    </div>
  )
}
