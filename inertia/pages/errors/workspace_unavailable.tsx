import { Link } from '@adonisjs/inertia/react'
export default function WorkspaceUnavailable() {
  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="mb-4 text-2xl font-semibold">Workspace unavailable</h1>
      <p className="mb-6">Your membership may have changed. Choose a workspace you can access.</p>
      <Link route="workspaces.index" className="underline">
        Your workspaces
      </Link>
    </div>
  )
}
