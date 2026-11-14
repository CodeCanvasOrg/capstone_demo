/**
 * Provider settings guardrails (OPS-02). Supported providers are an explicit
 * allowlist with fixed endpoints: there is no client-supplied URL and no
 * silent fallback to another provider, because that would send private
 * evidence somewhere the user did not choose. Durable key retention is a
 * separate, undecided policy (D-CREDENTIALS); this module only validates,
 * masks and redacts.
 */
export type ProviderDefinition = {
  label: string
  endpoint: string
  minKeyLength: number
}

export const PROVIDERS: Readonly<Record<string, ProviderDefinition>> = Object.freeze({
  openrouter: Object.freeze({
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    minKeyLength: 16,
  }),
})

export type ProviderFinding = { code: string; message: string }

export function checkProviderSettings(input: {
  provider: string
  apiKey: string
  endpoint?: string
}): ProviderFinding[] {
  const provider = Object.hasOwn(PROVIDERS, input.provider) ? PROVIDERS[input.provider] : undefined
  if (!provider)
    return [{ code: 'unsupported_provider', message: 'Choose one of the supported providers.' }]
  const found: ProviderFinding[] = []
  if (!input.apiKey?.trim()) found.push({ code: 'key_missing', message: 'Enter an API key.' })
  else if (input.apiKey.trim().length < provider.minKeyLength)
    found.push({ code: 'key_malformed', message: 'This API key looks too short.' })
  if (input.endpoint !== undefined && input.endpoint !== provider.endpoint)
    found.push({
      code: 'endpoint_not_allowed',
      message: 'Custom endpoints are not supported; the provider endpoint is fixed.',
    })
  return found
}

export function maskKey(key: string) {
  if (!key) return ''
  return key.length <= 8 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}`
}

const SECRET_KEY = /key|token|secret|password|authorization|credential/i
const SECRET_TEXT = [/Bearer\s+\S+/gi, /\bsk-[A-Za-z0-9_-]{8,}/g]

/** Removes secrets from log text and nested payloads; safe to apply to any value. */
export function redactSecrets<T>(value: T): T {
  if (typeof value === 'string')
    return SECRET_TEXT.reduce(
      (text, pattern) =>
        text.replace(pattern, (m) => (/^Bearer/i.test(m) ? 'Bearer [redacted]' : '[redacted]')),
      value as string
    ) as T
  if (Array.isArray(value)) return value.map(redactSecrets) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redactSecrets(item),
      ])
    ) as T
  return value
}
