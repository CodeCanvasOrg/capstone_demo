import { Head } from '@inertiajs/react'
import type { Data } from '@generated/data'
export default function Members({ members }: { members: Data.WorkspaceMembership[] }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <Head title="Workspace members" />
      <h1 className="text-3xl font-semibold">Workspace members</h1>
      <p className="text-muted-foreground">
        Every active member can collaborate on case studies and use the shared files library.
      </p>
      <ul className="divide-y rounded-xl border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{member.user?.fullName || member.user?.email}</p>
              <p className="text-sm text-muted-foreground">{member.user?.email}</p>
            </div>
            <span className="text-sm capitalize">{member.role}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
