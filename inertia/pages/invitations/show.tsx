import { Head, usePage } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
export default function Show({
  invitation,
  addressedAccount,
}: {
  invitation: {
    token: string
    workspaceName: string
    email: string
    expiresAt: string
    accepted: boolean
  }
  addressedAccount: boolean
}) {
  const { user } = usePage().props
  return (
    <section className="mx-auto max-w-lg px-5 py-20">
      <Head title="Workspace invitation" />
      <span className="mb-7 inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Users />
      </span>
      <p className="eyebrow">You’re invited</p>
      <h1 className="page-title mt-3 break-words text-3xl">Join {invitation.workspaceName}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Collaborate on case studies and share source files with the team. This invitation is for{' '}
        <strong className="break-all text-foreground">{invitation.email}</strong>.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Expires {new Date(invitation.expiresAt).toLocaleString()}
      </p>
      <div className="mt-8 rounded-xl border bg-sidebar p-5">
        {addressedAccount ? (
          <Form route="invitationAcceptances.store" routeParams={{ token: invitation.token }}>
            {({ processing }) => (
              <Button disabled={processing}>
                {processing
                  ? 'Joining…'
                  : invitation.accepted
                    ? 'Open workspace'
                    : 'Accept invitation'}
                <ArrowRight />
              </Button>
            )}
          </Form>
        ) : user ? (
          <>
            <p className="mb-4 text-sm">
              Sign in with the addressed account to accept this invitation.
            </p>
            <Form route="session.destroy">
              <Button variant="outline">Sign out</Button>
            </Form>
          </>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link route="session.create">Sign in to accept</Link>
            </Button>
            <Button asChild variant="outline">
              <Link route="new_account.create">Create account</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
