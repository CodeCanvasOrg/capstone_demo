import { useWorkspaceId } from '@/providers/workspace_provider'
import { Head } from '@inertiajs/react'
import { PageIntro } from '@/components/page_intro'
import { Reveal } from '@/components/reveal'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import UserForm from '@/components/files/user_form'

export default function Create() {
  const workspaceId = useWorkspaceId()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14">
      <Link
        route="files.index"
        routeParams={{ workspaceId }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to files
      </Link>

      <Head title="Upload files" />
      <PageIntro
        eyebrow="Build your library"
        title="Upload files"
        description="Add source documents, notes, or images. Your files can support more than one document."
      />

      <Reveal>
        <Card className="border-t-2 border-t-primary py-7">
          <CardContent className="px-5">
            <UserForm />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}
