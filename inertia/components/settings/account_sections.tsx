import { useMemo, useState, type FormEvent } from 'react'
import { router as inertia } from '@inertiajs/react'
import { useRouter } from '@adonisjs/inertia/react'
import { toast } from 'sonner'
import { Eye, EyeOff, Laptop, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { SettingsPayload } from '../../../shared/settings.ts'
import { FieldMessage, SectionHeader, SettingRow, SettingsGroup, ToggleRow } from './primitives'
import type { SectionProps } from './types'

function initialsFor(name: string | null, email: string) {
  const [first, last] = name?.trim() ? name.trim().split(/\s+/) : email.split('@')
  return (last ? `${first[0]}${last[0]}` : first.slice(0, 2)).toUpperCase()
}

function errorsFrom(error: unknown) {
  return error instanceof ApiError ? error.details : {}
}

export function ProfileSection({ data, setData }: SectionProps) {
  const [fullName, setFullName] = useState(data.profile.fullName ?? '')
  const [email, setEmail] = useState(data.profile.email)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const dirty = fullName !== (data.profile.fullName ?? '') || email !== data.profile.email
  const memberSince = useMemo(
    () =>
      new Date(data.profile.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [data.profile.createdAt]
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const result = await api<{ data: { fullName: string | null; email: string } }>(
        '/settings/profile',
        'PATCH',
        { fullName: fullName.trim() || null, email }
      )
      setData((current: SettingsPayload) => ({
        ...current,
        profile: { ...current.profile, ...result.data },
      }))
      inertia.reload({ only: ['user'] })
      toast.success('Profile updated')
    } catch (error) {
      setErrors(errorsFrom(error))
      if (!Object.keys(errorsFrom(error)).length) toast.error('Your profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader
        title="Profile"
        description="How you appear to collaborators in shared workspaces."
      />
      <form onSubmit={submit} noValidate>
        <div className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
            {initialsFor(fullName || null, email)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName || email}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">Member since {memberSince}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="settings-full-name">Full name</Label>
            <Input
              id="settings-full-name"
              className="mt-1.5"
              value={fullName}
              maxLength={120}
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={!!errors.fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <FieldMessage>{errors.fullName}</FieldMessage>
          </div>
          <div>
            <Label htmlFor="settings-email">Email</Label>
            <Input
              id="settings-email"
              type="email"
              className="mt-1.5"
              value={email}
              autoComplete="email"
              aria-invalid={!!errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldMessage>{errors.email}</FieldMessage>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setFullName(data.profile.fullName ?? '')
              setEmail(data.profile.email)
              setErrors({})
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </>
  )
}

function deviceName() {
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${os}`
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative mt-1.5">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        className="pr-9"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function SecuritySection({ data, updatePreference }: SectionProps) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const strength = [/.{12,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(next)).length
  const privacy = data.preferences.privacy

  async function submit(event: FormEvent) {
    event.preventDefault()
    const local: Record<string, string> = {}
    if (!current) local.currentPassword = 'Enter your current password.'
    if (next.length < 8) local.password = 'Use at least 8 characters.'
    if (next.length > 32) local.password = 'Use 32 characters or fewer.'
    if (next !== confirm) local.passwordConfirmation = 'Passwords do not match.'
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true)
    try {
      await api('/settings/password', 'PUT', {
        currentPassword: current,
        password: next,
        passwordConfirmation: confirm,
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password changed')
    } catch (error) {
      setErrors(errorsFrom(error))
      if (!Object.keys(errorsFrom(error)).length) toast.error('Your password could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader
        title="Security & privacy"
        description="Protect your account and control how your data is used."
      />
      <SettingsGroup
        title="Password"
        description="Use 8–32 characters. A longer passphrase is stronger."
      >
        <form onSubmit={submit} noValidate className="grid gap-4 p-4">
          <div>
            <Label htmlFor="settings-current-password">Current password</Label>
            <PasswordInput
              id="settings-current-password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
            />
            <FieldMessage>{errors.currentPassword}</FieldMessage>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="settings-new-password">New password</Label>
              <PasswordInput
                id="settings-new-password"
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                invalid={!!errors.password}
              />
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      next && i < Math.max(1, strength)
                        ? strength >= 3
                          ? 'bg-emerald-500'
                          : strength === 2
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <FieldMessage>{errors.password}</FieldMessage>
            </div>
            <div>
              <Label htmlFor="settings-confirm-password">Confirm new password</Label>
              <PasswordInput
                id="settings-confirm-password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                invalid={!!errors.passwordConfirmation}
              />
              <FieldMessage>{errors.passwordConfirmation}</FieldMessage>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !current || !next}>
              {saving && <Loader2 className="animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      </SettingsGroup>

      <SettingsGroup title="Sign-in">
        <SettingRow
          title={
            <span className="inline-flex items-center gap-2">
              Two-factor authentication <Badge variant="secondary">Coming soon</Badge>
            </span>
          }
          description="Require a code from an authenticator app when signing in."
          disabled
        >
          <ShieldCheck className="size-4 text-muted-foreground" />
        </SettingRow>
        <SettingRow
          title={
            <span className="inline-flex items-center gap-2">
              <Laptop className="size-4 text-muted-foreground" /> {deviceName()}
            </span>
          }
          description="Current session · Active now"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.post({ route: 'session.destroy' }, {})}
          >
            <LogOut /> Sign out
          </Button>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Privacy">
        <ToggleRow
          id="pref-usage-analytics"
          title="Share usage analytics"
          description="Anonymous feature usage that helps us prioritise improvements. Never includes document content."
          checked={privacy.usageAnalytics}
          onChange={(value) => updatePreference('privacy', 'usageAnalytics', value)}
        />
        <ToggleRow
          id="pref-improve-models"
          title="Allow content to improve generation"
          description="Let reviewed and approved case studies be used to tune prompts for your workspace."
          checked={privacy.improveModels}
          onChange={(value) => updatePreference('privacy', 'improveModels', value)}
        />
      </SettingsGroup>
    </>
  )
}
