import { Head } from '@inertiajs/react'
import { Form } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Mail, Users, UserMinus, Send, RotateCcw, Ban } from 'lucide-react'
import { useWorkspace } from '@/providers/workspace_provider'
import { PageIntro } from '@/components/page_intro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ConfirmAction } from '@/components/confirm_action'
export default function Members({
  members,
  invitations = [],
}: {
  members: Data.WorkspaceMembership[]
  invitations?: Data.WorkspaceInvitation[]
}) {
  const { workspace, workspaceCapabilities } = useWorkspace()
  if (!workspace) return null
  const workspaceId = workspace.id
  const canManage = workspaceCapabilities?.manageMembers
  return (
    <div className="page-wrap space-y-8">
      <Head title="Members and invitations" />
      <PageIntro title="Members" />
      <section className="overflow-hidden rounded-xl border bg-sidebar">
        <div className="flex items-center gap-2 border-b p-5">
          <Users className="size-4" />
          <h2 className="text-sm font-semibold">Members</h2>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <ul className="divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {(member.user?.fullName || member.user?.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.user?.fullName || member.user?.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.user?.email}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {member.role}
              </Badge>
              {canManage && member.role !== 'owner' && (
                <ConfirmAction
                  title="Remove member?"
                  description="This person will lose access to this workspace, its files, and its case studies. Their pending background work will be cancelled."
                  trigger="Remove"
                  icon={UserMinus}
                >
                  <Form
                    route="workspace_members.destroy"
                    routeParams={{ workspaceId, membershipId: member.id }}
                  >
                    {({ processing }) => (
                      <Button variant="destructive" disabled={processing}>
                        <UserMinus aria-hidden="true" />
                        Remove member
                      </Button>
                    )}
                  </Form>
                </ConfirmAction>
              )}
            </li>
          ))}
        </ul>
      </section>
      {canManage && (
        <>
          <section className="rounded-xl border bg-sidebar p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2">
              <Mail className="size-4" />
              <h2 className="font-semibold">Invite a teammate</h2>
            </div>
            <Form
              route="workspaceInvitations.store"
              routeParams={{ workspaceId }}
              className="space-y-4"
            >
              {({ processing, errors }) => (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      aria-describedby={errors.email ? 'invite-email-error' : undefined}
                      name="email"
                      type="email"
                      placeholder="teammate@company.com"
                      maxLength={254}
                      required
                      aria-invalid={!!errors.email}
                      disabled={processing}
                    />
                    {errors.email && (
                      <p id="invite-email-error" role="alert" className="text-sm text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valid for 7 days · Only this email can accept.
                  </p>
                  <Button disabled={processing}>
                    <Send aria-hidden="true" />
                    {processing ? 'Sending…' : 'Invite'}
                  </Button>
                </>
              )}
            </Form>
          </section>
          <section className="overflow-hidden rounded-xl border bg-sidebar">
            <h2 className="border-b p-5 text-sm font-semibold">Invitations</h2>
            {invitations.length ? (
              <ul className="divide-y">
                {invitations.map((invite) => {
                  const expired = invite.expired
                  const active = !invite.acceptedAt && !invite.revokedAt && !expired
                  return (
                    <li key={invite.id} className="flex flex-wrap items-center gap-3 p-5">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-medium">{invite.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {invite.acceptedAt
                            ? 'Accepted'
                            : invite.revokedAt
                              ? 'Revoked'
                              : expired
                                ? 'Expired'
                                : invite.deliveryState === 'failed'
                                  ? 'Delivery failed'
                                  : invite.deliveryState === 'sent'
                                    ? 'Email sent'
                                    : 'Email queued'}{' '}
                          · {new Date(invite.expiresAt ?? 0).toLocaleDateString()}
                        </p>
                      </div>
                      {!invite.acceptedAt && !invite.revokedAt && (
                        <Form
                          route="workspaceInvitations.resend"
                          routeParams={{ workspaceId, invitationId: invite.id }}
                        >
                          {({ processing }) => (
                            <Button variant="outline" size="sm" disabled={processing}>
                              <RotateCcw aria-hidden="true" />
                              Resend
                            </Button>
                          )}
                        </Form>
                      )}
                      {active && (
                        <ConfirmAction
                          trigger="Revoke"
                          icon={Ban}
                          title="Revoke invitation?"
                          description="The emailed invitation link will stop working."
                        >
                          <Form
                            route="workspaceInvitations.destroy"
                            routeParams={{ workspaceId, invitationId: invite.id }}
                          >
                            <Button variant="destructive">
                              <Ban aria-hidden="true" />
                              Revoke invitation
                            </Button>
                          </Form>
                        </ConfirmAction>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No invitations yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
