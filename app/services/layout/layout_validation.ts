import { Exception } from '@adonisjs/core/exceptions'
import { getBrandKit, validateBrandKit } from '../../../shared/layout/brand.ts'
import {
  DEFAULT_TEMPLATE_ID,
  checkCompatibility,
  getTemplate,
  resolveOptions,
  type LayoutOptions,
} from '../../../shared/layout/templates.ts'

/** What a document or preset pins. Versions are always concrete, never "latest". */
export type PinnedLayout = {
  templateId: string
  templateVersion: number
  brandId: string
  brandVersion: number
  options: LayoutOptions
}

export const DEFAULT_BRAND_ID = 'humblebee'
export const DOC_TYPE = 'case_study' as const

const invalid = (message: string) =>
  new Exception(message, { status: 422, code: 'E_LAYOUT_INVALID' })

/**
 * Single gate for any selection, from a document, a preset or a forged request.
 * Unknown ids, unsupported types, bad options and unpublished or unknown
 * template/brand versions are rejected; nothing falls back to a default.
 */
export function pinLayout(input: {
  templateId: string
  templateVersion?: number
  brandId?: string
  brandVersion?: number
  options?: unknown
}): PinnedLayout {
  const compatibility = checkCompatibility(input.templateId, DOC_TYPE, input.options ?? {}, {
    version: input.templateVersion,
  })
  if (!compatibility.ok)
    throw invalid(`Template or option not available: ${compatibility.errors[0].message}`)
  const template = getTemplate(input.templateId, input.templateVersion)!
  const brandId = input.brandId ?? DEFAULT_BRAND_ID
  const brand = getBrandKit(brandId, input.brandVersion)
  if (!brand) throw invalid('That brand version is not available.')
  if (validateBrandKit(brand).some((finding) => finding.severity === 'error'))
    throw invalid('That brand version cannot be used until its findings are resolved.')
  const { options } = resolveOptions(template, input.options ?? {})
  return {
    templateId: template.id,
    templateVersion: template.version,
    brandId: brand.id,
    brandVersion: brand.version,
    options,
  }
}

export const defaultLayout = (): PinnedLayout => pinLayout({ templateId: DEFAULT_TEMPLATE_ID })
