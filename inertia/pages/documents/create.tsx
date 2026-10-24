import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import type { Data } from '@generated/data'
import { DocumentForm } from '@/components/documents/form'
export default function Create({
  files,
  projects,
  initialProjectId,
}: {
  files: Data.File[]
  projects: Data.Project[]
  initialProjectId?: string | null
}) {
  const workspaceId = useWorkspaceId()
  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <Head title="New case study" />
      <header className="flex h-12 shrink-0 items-center border-b px-4">
        <Button asChild variant="ghost" size="icon-sm" title="Back to case studies">
          <Link
            route="documents.index"
            routeParams={{ workspaceId }}
            aria-label="Back to case studies"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
      </header>
      <DocumentForm files={files} projects={projects} initialProjectId={initialProjectId} />
    </div>
  )
}
