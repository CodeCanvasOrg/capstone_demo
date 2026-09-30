import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import UserForm from '@/components/files/user_form'

export default function Create() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14">
      <Link
        route="files.index"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to files
      </Link>

      <div className="mb-6 flex flex-col gap-2">
        <h1 className="font-serif text-3xl">Upload files</h1>
        <p className="text-sm text-muted-foreground">
          Add one or many files to your library so you can attach them to documents later.
        </p>
      </div>

      <Card>
        <CardContent className="px-5">
          <UserForm />
        </CardContent>
      </Card>
    </div>
  )
}
