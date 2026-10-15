import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function Index() {
  const { workspaces } = useWorkspace()
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Head title="Your workspaces" />
      <h1 className="mb-3 text-3xl font-semibold">Your workspaces</h1>
      <p className="mb-8 text-muted-foreground">
        Choose a workspace or create a new place for your team.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            route="workspaces.show"
            routeParams={{ workspaceId: workspace.id }}
            className="rounded-xl border bg-card p-6 font-medium hover:bg-accent"
          >
            {workspace.name}
          </Link>
        ))}
      </div>
      {workspaces.length === 0 && (
        <p className="mb-6 rounded-lg border p-4">
          You have no active workspace memberships. Create a workspace or accept an invitation.
        </p>
      )}
      <Form route="workspaces.store" className="mt-8 flex flex-col gap-3 rounded-xl border p-6">
        {({ processing, errors }) => (
          <>
            <Label htmlFor="workspace-name">Create workspace</Label>
            <Input
              id="workspace-name"
              name="name"
              maxLength={120}
              required
              placeholder="Workspace name"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
            <Button className="self-start" disabled={processing}>
              {processing ? 'Creating…' : 'Create workspace'}
            </Button>
          </>
        )}
      </Form>
    </div>
  )
}
