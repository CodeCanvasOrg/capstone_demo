import { isSafeLink } from '../publication/client.ts'
import { ENABLED_DOC_TYPES, type DocType } from '../publication/content.ts'

/**
 * Code-owned, immutable template definitions (TPL-02). A template says which
 * blocks exist, their order, and per-block rules; content comes from the
 * publication contract and styling from a brand kit, so the three change
 * independently. Published versions are frozen.
 */
export type BlockType =
  | 'hero'
  | 'results'
  | 'columns'
  | 'text'
  | 'steps'
  | 'capabilities'
  | 'roadmap'
  | 'figure'
  | 'cta'
  | 'sources'

export type BlockRule = {
  type: BlockType
  /** `collapse`: omitted without reserved space when there is no content. */
  onEmpty: 'collapse' | 'required'
  /** Smallest type size the fitting step may use for this block. */
  minFontPt: number
  baseFontPt: number
  compactFontPt: number
  /** Block types that must stay on the same page as this one. */
  keepWith: BlockType[]
}

export type TemplateDefinition = {
  id: string
  version: number
  title: string
  description: string
  docType: DocType
  pageBudget: number
  /** Sizing model inputs: text lines per page at the base size. */
  capacity: { linesPerPage: number; charsPerLine: number }
  options: {
    imageMode: readonly ['auto', 'with', 'without']
    cta: boolean
  }
  blocks: readonly BlockRule[]
  /** Another template to suggest when this one cannot fit. */
  fallbackTemplateId?: string
}

const block = (
  type: BlockType,
  onEmpty: BlockRule['onEmpty'],
  base: number,
  compact: number,
  keepWith: BlockType[] = []
): BlockRule => ({
  type,
  onEmpty,
  baseFontPt: base,
  compactFontPt: compact,
  minFontPt: compact,
  keepWith,
})

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const common = {
  docType: 'case_study' as const,
  options: { imageMode: ['auto', 'with', 'without'] as const, cta: true },
}

export const TEMPLATES: readonly TemplateDefinition[] = deepFreeze([
  {
    ...common,
    id: 'case_study_concise',
    version: 1,
    title: 'Case study — concise',
    description: 'One page including sources: hero, results, challenge, solution and CTA.',
    pageBudget: 1,
    capacity: { linesPerPage: 58, charsPerLine: 92 },
    fallbackTemplateId: 'case_study_standard',
    blocks: [
      block('hero', 'required', 20, 18),
      block('results', 'collapse', 20, 18, ['columns']),
      block('columns', 'collapse', 9.5, 9),
      block('text', 'required', 10, 9),
      block('steps', 'collapse', 9, 8.5),
      block('capabilities', 'collapse', 9, 8.5),
      block('roadmap', 'collapse', 9, 8.5),
      block('figure', 'collapse', 9, 9),
      block('cta', 'collapse', 10, 9),
      block('sources', 'collapse', 8.5, 8),
    ],
  },
  {
    ...common,
    id: 'case_study_standard',
    version: 1,
    title: 'Case study — standard',
    description: 'Up to two pages including sources, with optional figure and call to action.',
    pageBudget: 2,
    capacity: { linesPerPage: 54, charsPerLine: 90 },
    blocks: [
      block('hero', 'required', 24, 20),
      block('results', 'collapse', 24, 20, ['columns']),
      block('columns', 'collapse', 10.5, 10),
      block('text', 'required', 11, 10),
      block('steps', 'collapse', 10, 9),
      block('capabilities', 'collapse', 10, 9),
      block('roadmap', 'collapse', 10, 9),
      block('figure', 'collapse', 9, 9),
      block('cta', 'collapse', 11, 10),
      block('sources', 'collapse', 9, 8.5),
    ],
  },
]) as readonly TemplateDefinition[]

export const DEFAULT_TEMPLATE_ID = 'case_study_standard'

export function getTemplate(id: string, version?: number): TemplateDefinition | undefined {
  const matches = TEMPLATES.filter((template) => template.id === id)
  if (version !== undefined) return matches.find((template) => template.version === version)
  return matches.sort((a, b) => b.version - a.version)[0]
}

export function listTemplates({
  docType,
  disabled = [],
}: { docType?: DocType; disabled?: readonly string[] } = {}) {
  const latest = new Map<string, TemplateDefinition>()
  for (const template of TEMPLATES)
    if (!latest.has(template.id) || latest.get(template.id)!.version < template.version)
      latest.set(template.id, template)
  return [...latest.values()].filter(
    (template) =>
      !disabled.includes(template.id) &&
      (!docType || template.docType === docType) &&
      (ENABLED_DOC_TYPES as readonly string[]).includes(template.docType)
  )
}

export type LayoutOptions = {
  imageMode: 'auto' | 'with' | 'without'
  cta?: { label: string; href: string; headline?: string }
}
export type OptionError = { code: string; field: string; message: string }

/** Validates user options against the template; unknown keys and bad values are errors. */
export function resolveOptions(template: TemplateDefinition, input: unknown) {
  const errors: OptionError[] = []
  const raw =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  const options: LayoutOptions = { imageMode: 'auto' }
  for (const key of Object.keys(raw))
    if (!['imageMode', 'cta'].includes(key))
      errors.push({ code: 'unknown_option', field: key, message: 'This option is not supported.' })
  if (raw.imageMode !== undefined) {
    if ((template.options.imageMode as readonly unknown[]).includes(raw.imageMode))
      options.imageMode = raw.imageMode as LayoutOptions['imageMode']
    else
      errors.push({
        code: 'invalid_option_value',
        field: 'imageMode',
        message: 'Choose auto, with or without images.',
      })
  }
  if (raw.cta !== undefined) {
    const cta = raw.cta as { label?: unknown; href?: unknown; headline?: unknown }
    const headline = typeof cta?.headline === 'string' ? cta.headline.trim() : ''
    if (
      template.options.cta &&
      cta &&
      typeof cta.label === 'string' &&
      cta.label.trim() &&
      cta.label.length <= 80 &&
      typeof cta.href === 'string' &&
      isSafeLink(cta.href) &&
      (cta.headline === undefined || (typeof cta.headline === 'string' && headline.length <= 120))
    )
      options.cta = {
        label: cta.label.trim(),
        href: cta.href,
        ...(headline ? { headline } : {}),
      }
    else
      errors.push({
        code: 'invalid_option_value',
        field: 'cta',
        message: 'A call to action needs a short label and a safe http(s) or mailto link.',
      })
  }
  return { options, errors }
}

export type Compatibility = { ok: boolean; errors: { code: string; message: string }[] }

/**
 * Selection gate used before any rendering: unknown ids, disabled templates,
 * unimplemented content types and invalid options all fail here. There is no
 * fallback to the case-study layout.
 */
export function checkCompatibility(
  templateId: string,
  docType: string,
  options: unknown,
  { disabled = [], version }: { disabled?: readonly string[]; version?: number } = {}
): Compatibility {
  const error = (code: string, message: string): Compatibility => ({
    ok: false,
    errors: [{ code, message }],
  })
  if (!(ENABLED_DOC_TYPES as readonly string[]).includes(docType))
    return error('unsupported_doc_type', 'No template is available for this content type yet.')
  const template = getTemplate(String(templateId), version)
  if (!template) return error('unknown_template', 'Choose one of the listed templates.')
  if (disabled.includes(template.id))
    return error('template_disabled', 'This template is disabled.')
  if (template.docType !== docType)
    return error('incompatible_template', 'This template does not support this content type.')
  const { errors } = resolveOptions(template, options)
  return errors.length
    ? { ok: false, errors: errors.map(({ code, message }) => ({ code, message })) }
    : { ok: true, errors: [] }
}
