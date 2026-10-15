import { useWorkspaceId } from '@/providers/workspace_provider'
import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'
import { Reveal } from '@/components/reveal'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentForm } from '@/components/documents/form'

export default function Create() {
  const workspaceId = useWorkspaceId()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14">
      <Link
        route="documents.index"
        routeParams={{ workspaceId }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to documents
      </Link>

      <Head title="New document" />
      <PageIntro
        eyebrow="Create a story"
        title="New document"
        description="Give your story a direction, then add the source files for your draft."
      />

      <Reveal>
        <Card className="border-t-2 border-t-primary py-7">
          <CardContent className="px-5">
            <DocumentForm />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}
