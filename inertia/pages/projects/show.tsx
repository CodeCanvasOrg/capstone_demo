import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Plus, FolderOpen } from 'lucide-react'
import { urlFor } from '@/client'
import { CaseStudyList } from '@/components/documents/case_study_list'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { ProjectDialog } from '@/components/projects_dialog'
import { RichTextEditor, textToRichText } from '@/components/rich_text_editor'
export default function Show({
  project,
  documents,
}: {
  project: Data.Project
  documents: Data.Document[]
}) {
  const workspaceId = useWorkspaceId()
  const createUrl = `${urlFor('documents.create', { workspaceId })}?projectId=${project.id}`
  return (
    <div className="minimal-page max-w-5xl">
      <Head title={project.name} />
      <nav aria-label="Breadcrumb" className="mb-10 text-xs text-muted-foreground">
        <Link
          route="projects.index"
          routeParams={{ workspaceId }}
          className="hover:text-foreground"
        >
          Projects
        </Link>
        <span className="mx-2">/</span>
        {project.name}
      </nav>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <FolderOpen className="mb-4 size-6 text-muted-foreground" />
          <h1 className="break-words text-2xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <ProjectDialog project={project} />
      </header>
      {(project.description || project.descriptionContent) && (
        <RichTextEditor
          key={project.updatedAt}
          value={project.descriptionContent ?? textToRichText(project.description ?? '')}
          readOnly
          label="Project description"
          className="mt-6 max-w-3xl"
        />
      )}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
          <h2 className="text-sm font-medium">
            Case studies <span className="ml-2 text-muted-foreground">{documents.length}</span>
          </h2>
          <Button asChild size="sm">
            <Link href={createUrl}>
              <Plus className="size-3.5" />
              New case study
            </Link>
          </Button>
        </div>
        {documents.length ? (
          <CaseStudyList documents={documents} />
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No case studies yet.</p>
            <Button asChild variant="ghost" className="mt-3">
              <Link href={createUrl}>
                <Plus aria-hidden="true" />
                New case study
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
