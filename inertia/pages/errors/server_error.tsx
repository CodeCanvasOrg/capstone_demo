import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
export default function ErrorPage() {
  return (
    <section className="mx-auto max-w-lg px-6 py-24">
      <Head title="Something went wrong" />
      <h1 className="page-title text-2xl">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We could not open this page. Try again shortly.
      </p>
      <Button asChild className="mt-6">
        <Link route="home">Back to home</Link>
      </Button>
    </section>
  )
}
