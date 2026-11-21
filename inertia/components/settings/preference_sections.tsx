import { useMemo } from 'react'
import { Check, KeyRound, LocateFixed, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from 'cn'
import { useTheme, type ThemePreference } from '@/components/theme_provider'
import { startBeeTour } from '@/components/bee/bee_guide'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CITATION_STYLES,
  CREATIVITY,
  DATE_FORMATS,
  DIGESTS,
  LOCALES,
  PAGE_SIZES,
  WEEK_STARTS,
  WRITING_TONES,
} from '../../../shared/settings.ts'
import {
  SectionHeader,
  Segmented,
  SelectRow,
  SettingRow,
  SettingsGroup,
  ToggleRow,
} from './primitives'
import type { SectionProps } from './types'

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const optionsOf = <T extends string>(values: readonly T[], label = capitalise) =>
  values.map((value) => ({ value, label: label(value) }))

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function ThemePreview({ variant }: { variant: ThemePreference }) {
  const half = (dark: boolean) => (
    <div className={cn('flex h-full flex-1 gap-1 p-1.5', dark ? 'bg-zinc-900' : 'bg-white')}>
      <div className={cn('w-1/4 rounded-sm', dark ? 'bg-zinc-800' : 'bg-zinc-100')} />
      <div className="flex flex-1 flex-col gap-1">
        <div className={cn('h-1.5 w-3/4 rounded-full', dark ? 'bg-zinc-600' : 'bg-zinc-300')} />
        <div className={cn('h-1.5 w-1/2 rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
        <div className={cn('mt-auto h-3 rounded-sm', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
      </div>
    </div>
  )
  return (
    <div className="flex h-16 overflow-hidden rounded-md border">
      {variant === 'system' ? (
        <>
          {half(false)}
          {half(true)}
        </>
      ) : (
        half(variant === 'dark')
      )}
    </div>
  )
}

export function AppearanceSection({ data, updatePreference }: SectionProps) {
  const { preference, setTheme } = useTheme()
  const ui = data.preferences.interface
  return (
    <>
      <SectionHeader
        title="Appearance"
        description="Customise how CodeCanvas looks on this device."
      />
      <SettingsGroup title="Theme" description="Saved on this device.">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3 p-4">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={preference === theme.value}
              onClick={() => setTheme(theme.value)}
              className={cn(
                'group relative rounded-lg border p-2 text-left transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                preference === theme.value && 'border-primary ring-1 ring-primary'
              )}
            >
              <ThemePreview variant={theme.value} />
              <span className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                <theme.icon className="size-3.5" />
                {theme.label}
                {preference === theme.value && <Check className="ml-auto size-3.5 text-primary" />}
              </span>
            </button>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup title="Interface">
        <ToggleRow
          id="pref-compact-sidebar"
          title="Collapse sidebar by default"
          description="Start each page with the icon-only navigation rail."
          checked={ui.compactSidebar}
          onChange={(value) => updatePreference('interface', 'compactSidebar', value)}
        />
        <ToggleRow
          id="pref-reduce-motion"
          title="Reduce motion"
          description="Minimise animations, regardless of your system setting."
          checked={ui.reduceMotion}
          onChange={(value) => updatePreference('interface', 'reduceMotion', value)}
        />
        <ToggleRow
          id="pref-show-guide"
          title="Show the onboarding guide"
          description="Let the guide bee point out features as you explore."
          checked={ui.showGuide}
          onChange={(value) => updatePreference('interface', 'showGuide', value)}
        />
        <SettingRow
          title="Welcome tour"
          description="Walk through the main areas of the app again."
        >
          <Button variant="outline" size="sm" disabled={!ui.showGuide} onClick={startBeeTour}>
            Replay tour
          </Button>
        </SettingRow>
        <ToggleRow
          id="pref-confirm-delete"
          title="Confirm before deleting"
          description="Ask for confirmation before removing files, projects or case studies."
          checked={ui.confirmBeforeDelete}
          onChange={(value) => updatePreference('interface', 'confirmBeforeDelete', value)}
        />
      </SettingsGroup>
    </>
  )
}

const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  'en-US': 'English (United States)',
  'en-GB': 'English (United Kingdom)',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'pt-BR': 'Português (Brasil)',
  'ar-SA': 'العربية',
}

function dateExample(format: (typeof DATE_FORMATS)[number]) {
  const sample = new Date(2026, 2, 14)
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (format) {
    case 'relative':
      return 'Relative (2 days ago)'
    case 'MMM d, yyyy':
      return 'Mar 14, 2026'
    case 'dd/MM/yyyy':
      return `${pad(sample.getDate())}/${pad(sample.getMonth() + 1)}/2026`
    case 'yyyy-MM-dd':
      return '2026-03-14'
  }
}

export function PreferencesSection({ data, updatePreference }: SectionProps) {
  const region = data.preferences.region
  const editor = data.preferences.editor
  const timezones = useMemo(() => {
    const zones =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
    return Array.from(new Set(['UTC', region.timezone, ...zones]))
  }, [region.timezone])
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    <>
      <SectionHeader
        title="Preferences"
        description="Language, region and editor behaviour for your account."
      />
      <SettingsGroup title="Language & region">
        <SelectRow
          id="pref-locale"
          title="Language"
          description="Used for dates, numbers and interface text where available."
          value={region.locale}
          options={LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))}
          onChange={(value) => updatePreference('region', 'locale', value)}
        />
        <SettingRow
          title="Time zone"
          htmlFor="pref-timezone"
          description="Used for activity timestamps and digests."
        >
          <div className="flex items-center gap-2">
            <Select
              value={region.timezone}
              onValueChange={(value) => updatePreference('region', 'timezone', value)}
            >
              <SelectTrigger id="pref-timezone" className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Use detected time zone (${detected})`}
              title={`Detect (${detected})`}
              disabled={detected === region.timezone}
              onClick={() => updatePreference('region', 'timezone', detected)}
            >
              <LocateFixed />
            </Button>
          </div>
        </SettingRow>
        <SelectRow
          id="pref-date-format"
          title="Date format"
          value={region.dateFormat}
          options={DATE_FORMATS.map((value) => ({ value, label: dateExample(value) }))}
          onChange={(value) => updatePreference('region', 'dateFormat', value)}
        />
        <SelectRow
          id="pref-week-start"
          title="Week starts on"
          value={region.weekStartsOn}
          options={optionsOf(WEEK_STARTS)}
          onChange={(value) => updatePreference('region', 'weekStartsOn', value)}
        />
      </SettingsGroup>
      <SettingsGroup title="Editor">
        <ToggleRow
          id="pref-autosave"
          title="Autosave drafts"
          description="Save your edits in the background while you write."
          checked={editor.autosave}
          onChange={(value) => updatePreference('editor', 'autosave', value)}
        />
        <ToggleRow
          id="pref-spellcheck"
          title="Spellcheck"
          description="Underline spelling mistakes using your browser's dictionary."
          checked={editor.spellcheck}
          onChange={(value) => updatePreference('editor', 'spellcheck', value)}
        />
        <ToggleRow
          id="pref-word-count"
          title="Show word count"
          checked={editor.showWordCount}
          onChange={(value) => updatePreference('editor', 'showWordCount', value)}
        />
        <ToggleRow
          id="pref-smart-quotes"
          title="Smart punctuation"
          description="Convert straight quotes and double hyphens to typographic marks."
          checked={editor.smartQuotes}
          onChange={(value) => updatePreference('editor', 'smartQuotes', value)}
        />
        <SettingRow title="Default page size" description="Used for new PDF exports.">
          <Segmented
            label="Default page size"
            value={editor.pageSize}
            options={PAGE_SIZES.map((value) => ({
              value,
              label: value === 'a4' ? 'A4' : 'US Letter',
            }))}
            onChange={(value) => updatePreference('editor', 'pageSize', value)}
          />
        </SettingRow>
      </SettingsGroup>
    </>
  )
}

export function AiSection({ data, updatePreference, go }: SectionProps) {
  const ai = data.preferences.ai
  const hasModelKey = data.credentials.some((c) => c.kind === 'model')
  return (
    <>
      <SectionHeader
        title="AI & generation"
        description="Defaults the assistant uses when drafting and revising case studies."
      />
      <SettingsGroup title="Writing">
        <SelectRow
          id="pref-tone"
          title="Default tone"
          description="Applied to new drafts; you can still steer each request."
          value={ai.tone}
          options={optionsOf(WRITING_TONES)}
          onChange={(value) => updatePreference('ai', 'tone', value)}
        />
        <SettingRow
          title="Creativity"
          description="Precise sticks closely to your sources; creative takes more liberty with phrasing."
        >
          <Segmented
            label="Creativity"
            value={ai.creativity}
            options={optionsOf(CREATIVITY)}
            onChange={(value) => updatePreference('ai', 'creativity', value)}
          />
        </SettingRow>
        <SelectRow
          id="pref-citations"
          title="Source citations"
          description="How evidence from your files is referenced in drafts."
          value={ai.citations}
          options={optionsOf(CITATION_STYLES, (v) =>
            v === 'inline' ? 'Inline markers' : v === 'footnotes' ? 'Footnotes' : 'Hidden'
          )}
          onChange={(value) => updatePreference('ai', 'citations', value)}
        />
        <ToggleRow
          id="pref-image-analysis"
          title="Analyse images in sources"
          description="Send screenshots and diagrams from your files to the model for context."
          checked={ai.allowImageAnalysis}
          onChange={(value) => updatePreference('ai', 'allowImageAnalysis', value)}
        />
      </SettingsGroup>
      <SettingsGroup title="Models">
        <ToggleRow
          id="pref-own-keys"
          title="Use my own API keys"
          description={
            hasModelKey
              ? 'Generation is billed to your provider account instead of the workspace.'
              : 'Add a provider key first to enable this.'
          }
          checked={ai.useOwnKeys && hasModelKey}
          disabled={!hasModelKey}
          onChange={(value) => updatePreference('ai', 'useOwnKeys', value)}
        />
        <SettingRow
          title="Provider keys"
          description="Manage keys for OpenRouter, OpenAI, Anthropic and Google."
        >
          <Button variant="outline" size="sm" onClick={() => go('api-keys')}>
            <KeyRound /> Manage keys
          </Button>
        </SettingRow>
      </SettingsGroup>
    </>
  )
}

export function NotificationsSection({ data, updatePreference }: SectionProps) {
  const n = data.preferences.notifications
  const rows = [
    ['reviewRequested', 'Review requests', 'When someone asks you to review a case study.'],
    ['documentApproved', 'Approvals', 'When a case study you worked on is approved.'],
    ['generationFinished', 'Generation finished', 'When a long-running draft or export completes.'],
    ['commentsAndIssues', 'Comments & issues', 'When an issue is raised or resolved on your work.'],
    ['workspaceInvites', 'Workspace invitations', 'When you are invited to join a workspace.'],
  ] as const
  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Choose what we email you about. Account and security emails are always sent."
      />
      <SettingsGroup title="Email">
        {rows.map(([key, title, description]) => (
          <ToggleRow
            key={key}
            id={`pref-notify-${key}`}
            title={title}
            description={description}
            checked={n[key]}
            onChange={(value) => updatePreference('notifications', key, value)}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup title="Summaries">
        <SettingRow
          title="Activity digest"
          description="A roundup of workspace activity you may have missed."
        >
          <Segmented
            label="Activity digest"
            value={n.digest}
            options={optionsOf(DIGESTS)}
            onChange={(value) => updatePreference('notifications', 'digest', value)}
          />
        </SettingRow>
        <ToggleRow
          id="pref-product-updates"
          title="Product updates"
          description="Occasional news about new features and templates."
          checked={n.productUpdates}
          onChange={(value) => updatePreference('notifications', 'productUpdates', value)}
        />
      </SettingsGroup>
    </>
  )
}
