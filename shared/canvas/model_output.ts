import { z } from 'zod'

/**
 * Helpers for structured model calls: the JSON schema a model is shown and a lenient parse
 * that fixes what is only too long. Browser-safe.
 */

/** Cuts a string at the last word boundary within `max` characters. */
export function clipWords(value: string, max: number) {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '')
}

/**
 * The JSON schema a model is shown for a call. The length limits are left out of it:
 * the client library would refuse a value over a limit before `parseLenient` could cut
 * it. The prompts state the limits, and the schema still checks them after the cut.
 */
export function modelSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown =>
    Array.isArray(node)
      ? node.map(strip)
      : node && typeof node === 'object'
        ? Object.fromEntries(
            Object.entries(node)
              .filter(([key]) => key !== 'maxLength' && key !== 'maxItems')
              .map(([key, value]) => [key, strip(value)])
          )
        : node
  return strip(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })) as Record<
    string,
    unknown
  >
}

/**
 * Parses model output against a schema, fixing what is only too long: a string is cut
 * at a word and a list is cut to its limit. Length is the application's to fix (the
 * brochure's `fitPage` does the same); anything else wrong stays an error the model is
 * asked to correct. Browser-safe.
 */
export function parseLenient<T>(schema: z.ZodType<T>, value: unknown) {
  let current = structuredClone(value)
  for (let pass = 0; pass < 4; pass++) {
    const parsed = schema.safeParse(current)
    if (parsed.success) return parsed
    const issues = parsed.error.issues
    const fixable = issues.filter(
      (issue) => issue.code === 'too_big' && (issue.origin === 'string' || issue.origin === 'array')
    )
    if (!fixable.length || fixable.length < issues.length) return parsed
    for (const issue of fixable) {
      const path = issue.path as (string | number)[]
      const parent = path
        .slice(0, -1)
        .reduce<unknown>((node, key) => (node as Record<string | number, unknown>)?.[key], current)
      const key = path.at(-1)!
      const max = Number((issue as { maximum: number | bigint }).maximum)
      const target = parent as Record<string | number, unknown> | undefined
      const item = target?.[key]
      if (typeof item === 'string') target![key] = clipWords(item, max)
      else if (Array.isArray(item)) target![key] = item.slice(0, max)
    }
  }
  return schema.safeParse(current)
}
