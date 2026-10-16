import { Head } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { PageIntro } from '@/components/page_intro'
import { DocumentForm } from '@/components/documents/form'
export default function Create({
  files,
  projects,
}: {
  files: Data.File[]
  projects: Data.Project[]
}) {
  return (
    <div className="page-wrap max-w-3xl">
      <Head title="New case study" />
      <PageIntro
        eyebrow="Case studies / New draft"
        title="Start with the work."
        description="Bring the project details and supporting evidence together. Shape the story in the editor."
      />
      <div className="rounded-2xl border bg-sidebar p-5 sm:p-8">
        <DocumentForm files={files} projects={projects} />
      </div>
    </div>
  )
}
