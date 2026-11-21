import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Eye, EyeOff, Loader2, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  CREDENTIAL_PROVIDERS,
  type CredentialKind,
  type CredentialProvider,
  type CredentialView,
} from '../../../shared/settings.ts'
import { FieldMessage, SectionHeader } from './primitives'
import type { SectionProps } from './types'

const MONOGRAM_COLORS: Record<string, string> = {
  openrouter: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  openai: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  anthropic: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  google_ai: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  slack: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  notion: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  webhook: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  google_drive: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  dropbox: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  github: 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300',
}

function Monogram({ provider }: { provider: CredentialProvider }) {
  const letters = provider.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold',
        MONOGRAM_COLORS[provider.id] ?? 'bg-muted'
      )}
    >
      {letters}
    </span>
  )
}

function relative(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CredentialCard({
  provider,
  credential,
  onSaved,
  onRemoved,
}: {
  provider: CredentialProvider
  credential?: CredentialView
  onSaved: (credential: CredentialView) => void
  onRemoved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [secret, setSecret] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const url = `/settings/credentials/${provider.kind}/${provider.id}`
  const inputId = `credential-${provider.kind}-${provider.id}`

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!secret.trim()) return setError('Paste a value to continue.')
    setBusy('save')
    setError(undefined)
    try {
      const result = await api<{ data: CredentialView }>(url, 'PUT', { secret: secret.trim() })
      onSaved(result.data)
      setSecret('')
      setEditing(false)
      toast.success(`${provider.name} ${credential ? 'updated' : 'connected'}`)
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.details.secret ?? failure.message)
          : `${provider.name} could not be saved.`
      )
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('remove')
    try {
      await api(url, 'DELETE')
      onRemoved()
      setConfirmRemove(false)
      toast.success(`${provider.name} disconnected`)
    } catch {
      toast.error(`${provider.name} could not be disconnected.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <Monogram provider={provider} />
        <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{provider.name}</p>
            {provider.comingSoon ? (
              <Badge variant="secondary">Coming soon</Badge>
            ) : credential ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{provider.description}</p>
          {credential && !editing && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {credential.hint} · added {relative(credential.createdAt)}
              {credential.lastUsedAt && ` · last used ${relative(credential.lastUsedAt)}`}
            </p>
          )}
        </div>
        {!provider.comingSoon && !editing && (
          <div className="ml-12 flex shrink-0 items-center gap-1 sm:ml-0">
            {credential ? (
              confirmRemove ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                    Keep
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy === 'remove'}
                    onClick={remove}
                  >
                    {busy === 'remove' && <Loader2 className="animate-spin" />}
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <RefreshCw /> Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${provider.name}`}
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Plus /> {provider.kind === 'model' ? 'Add key' : 'Connect'}
              </Button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <form onSubmit={save} noValidate className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={inputId}>{provider.secretLabel}</Label>
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Where do I find this? <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="relative mt-1.5">
            <Input
              id={inputId}
              autoFocus
              type={visible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.placeholder}
              value={secret}
              aria-invalid={!!error}
              className="pr-9 font-mono text-xs"
              onChange={(event) => setSecret(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide value' : 'Show value'}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldMessage>{error}</FieldMessage>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
                setSecret('')
                setError(undefined)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy === 'save' || !secret.trim()}>
              {busy === 'save' && <Loader2 className="animate-spin" />}
              {credential ? 'Save new value' : 'Save'}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

function CredentialList({ kind, data, setData }: SectionProps & { kind: CredentialKind }) {
  const providers = CREDENTIAL_PROVIDERS.filter((p) => p.kind === kind)
  const ordered = [
    ...providers.filter((p) => !p.comingSoon),
    ...providers.filter((p) => p.comingSoon),
  ]
  return (
    <ul className="grid gap-3">
      {ordered.map((provider) => (
        <CredentialCard
          key={provider.id}
          provider={provider}
          credential={data.credentials.find((c) => c.kind === kind && c.provider === provider.id)}
          onSaved={(credential) =>
            setData((current) => ({
              ...current,
              credentials: [
                ...current.credentials.filter(
                  (c) => !(c.kind === kind && c.provider === provider.id)
                ),
                credential,
              ],
            }))
          }
          onRemoved={() =>
            setData((current) => ({
              ...current,
              credentials: current.credentials.filter(
                (c) => !(c.kind === kind && c.provider === provider.id)
              ),
            }))
          }
        />
      ))}
    </ul>
  )
}

function SecurityNote({ children }: { children: string }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
      <Lock className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </p>
  )
}

export function ApiKeysSection(props: SectionProps) {
  return (
    <>
      <SectionHeader
        title="API keys"
        description="Bring your own model provider keys for drafting, revisions and embeddings."
      />
      <SecurityNote>
        Keys are encrypted at rest with AES-256-GCM and are never shown again after you save them —
        only the last four characters are kept for reference.
      </SecurityNote>
      <CredentialList kind="model" {...props} />
    </>
  )
}

export function ConnectorsSection(props: SectionProps) {
  return (
    <>
      <SectionHeader
        title="Connectors"
        description="Connect the tools your team already uses to bring sources in and send updates out."
      />
      <SecurityNote>
        Connector secrets are encrypted and only used by the server. Disconnecting removes the
        stored credential immediately.
      </SecurityNote>
      <CredentialList kind="connector" {...props} />
    </>
  )
}
