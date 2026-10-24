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
    <div className="page-wrap max-w-3xl">
      <Link
        route="files.index"
        routeParams={{ workspaceId }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Files
      </Link>

      <Head title="Upload files" />
      <PageIntro title="Upload files" />

      <Reveal>
        <Card className="border bg-sidebar py-7">
          <CardContent className="px-5">
            <UserForm />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}
