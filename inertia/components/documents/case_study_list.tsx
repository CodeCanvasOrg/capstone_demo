import type { Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { ArrowUpRight, FileText, CalendarDays } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { StatusBadge } from './status'
export function CaseStudyList({ documents }: { documents: Data.Document[] }) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="overflow-hidden rounded-2xl border bg-sidebar">
      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_9rem_2rem] gap-4 border-b px-6 py-3 text-[.625rem] font-bold tracking-wider text-muted-foreground uppercase md:grid">
        <span>Case study</span>
        <span>Status</span>
        <span>Last edited</span>
        <span />
      </div>
      <ul className="divide-y">
        {documents.map((doc) => (
          <li key={doc.id}>
            <Link
              route="documents.edit"
              routeParams={{ workspaceId, id: doc.id }}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 transition-colors hover:bg-accent md:grid-cols-[minmax(0,1fr)_9rem_9rem_2rem]"
            >
              <div className="flex min-w-0 gap-3">
                <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-lg border bg-background">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{doc.title}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doc.user?.fullName || doc.user?.email || 'Workspace case study'}
                    {doc.dueDate && (
                      <span className="ml-3 inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {doc.dueDate.slice(0, 10)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <StatusBadge status={doc.status} />
              <span className="hidden text-xs text-muted-foreground md:block">
                {doc.updatedAt
                  ? new Date(doc.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Just now'}
              </span>
              <ArrowUpRight
                className="hidden size-4 text-muted-foreground group-hover:text-foreground md:block"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
