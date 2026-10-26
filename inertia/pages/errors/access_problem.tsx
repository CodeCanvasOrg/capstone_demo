import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
export default function AccessProblem({ status = 404 }: { status?: number }) {
  return (
    <section className="mx-auto max-w-lg px-6 py-24">
      <Head title="Access unavailable" />
      <p className="eyebrow">{status} / Access unavailable</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">This link is unavailable.</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {status === 410
          ? 'This link expired or was revoked. Request a new invitation.'
          : status === 403
            ? 'Your account does not have permission to perform this action.'
            : 'The item could not be found in a workspace you can access.'}
      </p>
      <Button asChild className="mt-8">
        <Link route="home">Back to home</Link>
      </Button>
    </section>
  )
}
