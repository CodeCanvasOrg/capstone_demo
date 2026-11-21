import { useState, type FormEvent } from 'react'
import { router as inertia, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { toast } from 'sonner'
import { ArrowUpRight, Check, Copy, Loader2 } from 'lucide-react'
import type { Data } from '@generated/data'
import { api, ApiError } from '@/lib/api'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldMessage, SectionHeader, SettingRow, SettingsGroup } from './primitives'

export function WorkspaceSection({ onNavigate }: { onNavigate: () => void }) {
  const { workspace, workspaces } = useWorkspace()
  const { membership, user } = usePage<Data.SharedProps>().props
  const [name, setName] = useState(workspace?.name ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const isOwner = !!workspace && workspace.ownerUserId === user?.id

  if (!workspace)
    return (
      <>
        <SectionHeader title="Workspace" description="Choose a workspace to manage its settings." />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a workspace selected. Pick one from the workspace switcher in the
          sidebar.
        </p>
      </>
    )

  async function rename(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter a workspace name.')
    setSaving(true)
    setError(undefined)
    try {
      await api(`/workspaces/${workspace!.id}`, 'PATCH', { name: name.trim() })
      inertia.reload({ only: ['workspace', 'workspaces'] })
      toast.success('Workspace renamed')
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.details.name ?? failure.message)
          : 'The workspace could not be renamed.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function copyId() {
    await navigator.clipboard.writeText(workspace!.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <SectionHeader
        title="Workspace"
        description="Settings for the workspace you're currently in."
      />
      <SettingsGroup title="General">
        <form onSubmit={rename} noValidate className="p-4">
          <Label htmlFor="settings-workspace-name">Workspace name</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="settings-workspace-name"
              value={name}
              maxLength={120}
              disabled={!isOwner}
              aria-invalid={!!error}
              onChange={(event) => setName(event.target.value)}
            />
            {isOwner && (
              <Button type="submit" disabled={saving || name.trim() === workspace.name}>
                {saving && <Loader2 className="animate-spin" />}
                Rename
              </Button>
            )}
          </div>
          <FieldMessage>{error}</FieldMessage>
          {!isOwner && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Only the workspace owner can rename it.
            </p>
          )}
        </form>
        <SettingRow title="Workspace ID" description="Reference this when contacting support.">
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={copyId}>
            {workspace.id.slice(0, 8)}…{copied ? <Check className="text-emerald-500" /> : <Copy />}
          </Button>
        </SettingRow>
        <SettingRow title="Your role">
          <span className="text-sm capitalize">
            {isOwner ? 'Owner' : (membership?.role ?? 'Member')}
          </span>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="People">
        <SettingRow
          title="Members & invitations"
          description="Invite collaborators and manage who has access."
        >
          <Button variant="outline" size="sm" asChild>
            <Link
              route="workspace_members.index"
              routeParams={{ workspaceId: workspace.id }}
              onClick={onNavigate}
            >
              Open members <ArrowUpRight />
            </Link>
          </Button>
        </SettingRow>
        <SettingRow
          title="Your workspaces"
          description={`You belong to ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`}
        >
          <Button variant="outline" size="sm" asChild>
            <Link route="workspaces.index" onClick={onNavigate}>
              View all <ArrowUpRight />
            </Link>
          </Button>
        </SettingRow>
      </SettingsGroup>
    </>
  )
}
