import { z } from 'zod'

/**
 * Account preferences shared by the settings API and the settings dialog.
 * Stored as JSON on the user; anything missing falls back to the defaults,
 * so new preferences can be added without a data migration.
 */
export const LOCALES = ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'pt-BR', 'ar-SA'] as const
export const DATE_FORMATS = ['relative', 'MMM d, yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'] as const
export const WEEK_STARTS = ['monday', 'sunday', 'saturday'] as const
export const WRITING_TONES = ['professional', 'conversational', 'technical', 'persuasive'] as const
export const CREATIVITY = ['precise', 'balanced', 'creative'] as const
export const CITATION_STYLES = ['inline', 'footnotes', 'off'] as const
export const PAGE_SIZES = ['a4', 'letter'] as const
export const DIGESTS = ['off', 'daily', 'weekly'] as const

export const preferencesSchema = z.object({
  region: z.object({
    locale: z.enum(LOCALES),
    timezone: z.string().trim().min(1).max(64),
    dateFormat: z.enum(DATE_FORMATS),
    weekStartsOn: z.enum(WEEK_STARTS),
  }),
  interface: z.object({
    compactSidebar: z.boolean(),
    reduceMotion: z.boolean(),
    showGuide: z.boolean(),
    confirmBeforeDelete: z.boolean(),
  }),
  editor: z.object({
    autosave: z.boolean(),
    spellcheck: z.boolean(),
    showWordCount: z.boolean(),
    smartQuotes: z.boolean(),
    pageSize: z.enum(PAGE_SIZES),
  }),
  ai: z.object({
    tone: z.enum(WRITING_TONES),
    creativity: z.enum(CREATIVITY),
    citations: z.enum(CITATION_STYLES),
    useOwnKeys: z.boolean(),
    allowImageAnalysis: z.boolean(),
  }),
  notifications: z.object({
    reviewRequested: z.boolean(),
    documentApproved: z.boolean(),
    generationFinished: z.boolean(),
    commentsAndIssues: z.boolean(),
    workspaceInvites: z.boolean(),
    productUpdates: z.boolean(),
    digest: z.enum(DIGESTS),
  }),
  privacy: z.object({
    usageAnalytics: z.boolean(),
    improveModels: z.boolean(),
  }),
})

export type Preferences = z.infer<typeof preferencesSchema>

export const DEFAULT_PREFERENCES: Preferences = {
  region: { locale: 'en-US', timezone: 'UTC', dateFormat: 'relative', weekStartsOn: 'monday' },
  interface: {
    compactSidebar: false,
    reduceMotion: false,
    showGuide: true,
    confirmBeforeDelete: true,
  },
  editor: {
    autosave: true,
    spellcheck: true,
    showWordCount: true,
    smartQuotes: true,
    pageSize: 'a4',
  },
  ai: {
    tone: 'professional',
    creativity: 'balanced',
    citations: 'inline',
    useOwnKeys: false,
    allowImageAnalysis: true,
  },
  notifications: {
    reviewRequested: true,
    documentApproved: true,
    generationFinished: true,
    commentsAndIssues: true,
    workspaceInvites: true,
    productUpdates: false,
    digest: 'weekly',
  },
  privacy: { usageAnalytics: true, improveModels: false },
}

/** Merge stored (possibly partial or stale) preferences over the defaults, dropping bad values. */
export function resolvePreferences(stored: unknown): Preferences {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
  const result = structuredClone(DEFAULT_PREFERENCES) as Record<string, Record<string, unknown>>
  for (const [section, defaults] of Object.entries(result)) {
    const incoming = source[section]
    if (!incoming || typeof incoming !== 'object') continue
    const shape = (preferencesSchema.shape as Record<string, z.ZodObject<any>>)[section].shape
    for (const key of Object.keys(defaults)) {
      const parsed = shape[key].safeParse((incoming as Record<string, unknown>)[key])
      if (parsed.success) defaults[key] = parsed.data
    }
  }
  return result as Preferences
}

/** A partial update: any subset of sections and keys. */
export const preferencesPatchSchema = z
  .object(
    Object.fromEntries(
      Object.entries(preferencesSchema.shape).map(([key, section]) => [
        key,
        (section as z.ZodObject<any>).partial().strict().optional(),
      ])
    ) as { [K in keyof Preferences]: z.ZodOptional<z.ZodObject<any>> }
  )
  .strict()

export type CredentialKind = 'model' | 'connector'

export type CredentialProvider = {
  id: string
  kind: CredentialKind
  name: string
  description: string
  /** What the secret is called in the UI. */
  secretLabel: string
  placeholder: string
  /** Validates the shape of the secret before it is stored. */
  pattern: RegExp
  docsUrl: string
  /** Not yet connectable: shown so the catalog reads complete, but disabled. */
  comingSoon?: boolean
}

export const CREDENTIAL_PROVIDERS: CredentialProvider[] = [
  {
    id: 'openrouter',
    kind: 'model',
    name: 'OpenRouter',
    description: 'Route generation through your own OpenRouter account and model quota.',
    secretLabel: 'API key',
    placeholder: 'sk-or-v1-…',
    pattern: /^sk-or-[A-Za-z0-9_-]{16,}$/,
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'openai',
    kind: 'model',
    name: 'OpenAI',
    description: 'Use GPT models and embeddings billed to your OpenAI organization.',
    secretLabel: 'API key',
    placeholder: 'sk-…',
    pattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    kind: 'model',
    name: 'Anthropic',
    description: 'Use Claude models for drafting, revisions and claim review.',
    secretLabel: 'API key',
    placeholder: 'sk-ant-…',
    pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google_ai',
    kind: 'model',
    name: 'Google AI Studio',
    description: 'Use Gemini models with a key from Google AI Studio.',
    secretLabel: 'API key',
    placeholder: 'AIza…',
    pattern: /^AIza[A-Za-z0-9_-]{30,}$/,
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'slack',
    kind: 'connector',
    name: 'Slack',
    description: 'Post approvals and review requests to a Slack channel.',
    secretLabel: 'Incoming webhook URL',
    placeholder: 'https://hooks.slack.com/services/…',
    pattern: /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/,
    docsUrl: 'https://api.slack.com/messaging/webhooks',
  },
  {
    id: 'notion',
    kind: 'connector',
    name: 'Notion',
    description: 'Import project pages from Notion as source material.',
    secretLabel: 'Internal integration secret',
    placeholder: 'ntn_…',
    pattern: /^(ntn_|secret_)[A-Za-z0-9]{20,}$/,
    docsUrl: 'https://www.notion.so/my-integrations',
  },
  {
    id: 'webhook',
    kind: 'connector',
    name: 'Custom webhook',
    description: 'Send a JSON event to your endpoint when a case study is approved.',
    secretLabel: 'Endpoint URL',
    placeholder: 'https://example.com/hooks/codecanvas',
    pattern: /^https:\/\/[^\s]+$/,
    docsUrl: 'https://en.wikipedia.org/wiki/Webhook',
  },
  {
    id: 'google_drive',
    kind: 'connector',
    name: 'Google Drive',
    description: 'Pick source files straight from Drive.',
    secretLabel: '',
    placeholder: '',
    pattern: /^$/,
    docsUrl: 'https://drive.google.com',
    comingSoon: true,
  },
  {
    id: 'dropbox',
    kind: 'connector',
    name: 'Dropbox',
    description: 'Sync project folders from Dropbox.',
    secretLabel: '',
    placeholder: '',
    pattern: /^$/,
    docsUrl: 'https://www.dropbox.com',
    comingSoon: true,
  },
  {
    id: 'github',
    kind: 'connector',
    name: 'GitHub',
    description: 'Pull READMEs and release notes into case studies.',
    secretLabel: '',
    placeholder: '',
    pattern: /^$/,
    docsUrl: 'https://github.com',
    comingSoon: true,
  },
]

export function findProvider(kind: string, id: string) {
  return CREDENTIAL_PROVIDERS.find((p) => p.kind === kind && p.id === id && !p.comingSoon)
}

/** A non-reversible hint, e.g. "…a1B2" for keys or the host for URLs. */
export function secretHint(secret: string) {
  if (/^https:\/\//.test(secret)) {
    try {
      return new URL(secret).hostname.slice(0, 16)
    } catch {
      return 'URL'
    }
  }
  return `…${secret.slice(-4)}`
}

export type CredentialView = {
  id: string
  kind: CredentialKind
  provider: string
  label: string | null
  hint: string
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SettingsPayload = {
  profile: { id: number; fullName: string | null; email: string; createdAt: string }
  preferences: Preferences
  credentials: CredentialView[]
}
