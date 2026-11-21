import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
export default function ErrorPage() {
  return (
    <section className="mx-auto max-w-lg px-6 py-24">
      <Head title="Page not found" />
      <h1 className="page-title text-2xl">Page not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This page may have moved or is no longer available.
      </p>
      <Button asChild className="mt-6">
        <Link route="home">Back to home</Link>
      </Button>
    </section>
  )
}
