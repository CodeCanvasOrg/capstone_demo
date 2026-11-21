import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { router as inertia } from '@inertiajs/react'
import { toast } from 'sonner'
import {
  Bell,
  Building2,
  KeyRound,
  Loader2,
  Palette,
  Plug,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { SettingsPayload } from '../../../shared/settings.ts'
import { ProfileSection, SecuritySection } from './account_sections'
import {
  AiSection,
  AppearanceSection,
  NotificationsSection,
  PreferencesSection,
} from './preference_sections'
import { ApiKeysSection, ConnectorsSection } from './integration_sections'
import { WorkspaceSection } from './workspace_section'
import type { SectionProps, SettingsTab, UpdatePreference } from './types'

const NAV: { heading: string; items: { id: SettingsTab; label: string; icon: LucideIcon }[] }[] = [
  {
    heading: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'security', label: 'Security & privacy', icon: Shield },
    ],
  },
  {
    heading: 'App',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
      { id: 'ai', label: 'AI & generation', icon: Sparkles },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    heading: 'Integrations',
    items: [
      { id: 'api-keys', label: 'API keys', icon: KeyRound },
      { id: 'connectors', label: 'Connectors', icon: Plug },
    ],
  },
  {
    heading: 'Workspace',
    items: [{ id: 'workspace', label: 'General', icon: Building2 }],
  },
]

type SettingsContextValue = { openSettings: (tab?: SettingsTab) => void }
const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('profile')
  // Bumped on every open so a fresh copy of the settings is fetched each time.
  const [session, setSession] = useState(0)
  const show = useCallback(() => {
    setSession((n) => n + 1)
    setOpen(true)
  }, [])
  const openSettings = useCallback(
    (next: SettingsTab = 'profile') => {
      setTab(next)
      show()
    },
    [show]
  )

  // ⌘, / Ctrl+, opens settings, matching desktop app conventions.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  return (
    <SettingsContext.Provider value={{ openSettings }}>
      {children}
      <SettingsDialog
        session={session}
        open={open}
        onOpenChange={setOpen}
        tab={tab}
        onTabChange={setTab}
      />
    </SettingsContext.Provider>
  )
}

function SettingsDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  session,
}: {
  session: number
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}) {
  const [data, setData] = useState<SettingsPayload | null>(null)
  const [failedRequest, setFailedRequest] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const request = `${session}:${attempt}`
  const failed = failedRequest === request

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    api<{ data: SettingsPayload }>('/settings', 'GET', undefined, controller.signal)
      .then((result) => setData(result.data))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setFailedRequest(request)
      })
    return () => controller.abort()
  }, [open, request])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
    document
      .querySelector('[data-settings-tab][aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  const updatePreference = useCallback<UpdatePreference>((section, key, value) => {
    type Value = typeof value
    let previous: Value | undefined
    const write = (next: Value) =>
      setData((current) => {
        if (!current) return current
        previous ??= current.preferences[section][key]
        return {
          ...current,
          preferences: {
            ...current.preferences,
            [section]: { ...current.preferences[section], [key]: next },
          },
        }
      })
    write(value)
    api('/settings/preferences', 'PATCH', { [section]: { [key]: value } })
      .then(() => inertia.reload({ only: ['preferences'] }))
      .catch(() => {
        if (previous !== undefined) write(previous)
        toast.error('That preference could not be saved. Try again.')
      })
  }, [])

  const close = () => onOpenChange(false)
  const props: SectionProps | null = data
    ? {
        data,
        setData: setData as SectionProps['setData'],
        updatePreference,
        go: onTabChange,
      }
    : null
  const current = NAV.flatMap((g) => g.items).find((i) => i.id === tab)!

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:flex-row">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile, preferences, API keys, connectors and workspace.
        </DialogDescription>
        <nav
          aria-label="Settings sections"
          className="shrink-0 border-b bg-sidebar md:w-56 md:border-r md:border-b-0"
        >
          <p className="hidden px-5 pt-5 pb-3 font-heading text-base font-semibold md:block">
            Settings
          </p>
          <div className="flex gap-1 mr-11 overflow-x-auto p-2 md:mr-0 md:flex-col md:gap-4 md:overflow-visible md:px-3 md:pt-0">
            {NAV.map((group) => (
              <div key={group.heading} className="flex gap-1 md:flex-col md:gap-0.5">
                <p className="hidden px-2 pb-1 text-[.6875rem] font-medium tracking-wide text-muted-foreground uppercase md:block">
                  {group.heading}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-settings-tab
                    aria-current={tab === item.id ? 'page' : undefined}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                      tab === item.id && 'bg-sidebar-accent text-foreground'
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8"
          aria-label={current.label}
          role="region"
        >
          {tab === 'workspace' ? (
            <WorkspaceSection onNavigate={close} />
          ) : !props ? (
            failed ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-sm font-medium">Settings could not be loaded.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Check your connection.</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    Try again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center" aria-busy="true">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">Loading settings</span>
              </div>
            )
          ) : tab === 'profile' ? (
            <ProfileSection {...props} />
          ) : tab === 'security' ? (
            <SecuritySection {...props} />
          ) : tab === 'appearance' ? (
            <AppearanceSection {...props} />
          ) : tab === 'preferences' ? (
            <PreferencesSection {...props} />
          ) : tab === 'ai' ? (
            <AiSection {...props} />
          ) : tab === 'notifications' ? (
            <NotificationsSection {...props} />
          ) : tab === 'api-keys' ? (
            <ApiKeysSection {...props} />
          ) : (
            <ConnectorsSection {...props} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
