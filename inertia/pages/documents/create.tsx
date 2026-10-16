import { Head } from '@inertiajs/react'
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
  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <Head title="New case study" />
      <header className="flex h-12 shrink-0 items-center border-b px-6 text-xs text-muted-foreground">
        New case study
      </header>
      <DocumentForm files={files} projects={projects} initialProjectId={initialProjectId} />
    </div>
  )
}
