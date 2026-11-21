/**
 * Versioned brand kits (TPL-01). Browser-safe, code-owned data: published
 * versions are frozen, so an old document keeps rendering with the kit it was
 * approved against. Asset references are registered ids, never remote URLs.
 */
export type BrandFont = {
  family: string
  weight: number
  /** Package-relative woff2 path, resolved server-side only. */
  file: string
  /** Variable fonts are rejected for published kits: Chromium may emit Type 3 for them. */
  variable?: boolean
}

export type BrandKit = {
  id: string
  version: number
  name: string
  status: 'draft' | 'published'
  palette: {
    primary: string
    accent: string
    /** Accent readable as text on white (the bright accent is for fills). */
    accentText: string
    text: string
    muted: string
    background: string
    surface: string
  }
  fonts: BrandFont[]
  /** `text` renders the canonical name as a wordmark; no image is invented. */
  logo?: { assetId: string; kind: 'text' | 'image' }
  glossary: { canonical: string; variants: string[] }[]
  contact: { email?: string; website?: string; phone?: string }
  /** Who confirmed the identity values; null until marketing signs off (D-BRAND). */
  confirmedBy: string | null
}

export type BrandFinding = {
  code: string
  severity: 'error' | 'warning'
  message: string
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const manrope = (weight: number): BrandFont => ({
  family: 'Manrope',
  weight,
  file: `@fontsource/manrope/files/manrope-latin-${weight}-normal.woff2`,
})

export const BRAND_KITS: readonly BrandKit[] = deepFreeze([
  {
    id: 'humblebee',
    version: 1,
    name: 'HumbleBee AI',
    status: 'published',
    // HumbleBee brand colours from humblebee.ai: near-black #111, amber #ffb902, cream #f2f0e9.
    palette: {
      primary: '#111111',
      accent: '#ffb902',
      accentText: '#946500',
      text: '#111111',
      muted: '#57554f',
      background: '#ffffff',
      surface: '#f2f0e9',
    },
    fonts: [manrope(400), manrope(600), manrope(700), manrope(800)],
    logo: { assetId: 'wordmark-text', kind: 'text' },
    glossary: [
      {
        canonical: 'HumbleBee AI',
        variants: [
          'Humblebee AI',
          'Humble Bee AI',
          'Humble bee AI',
          'humblebee AI',
          'HumbleBee Ai',
        ],
      },
    ],
    contact: {},
    confirmedBy: null,
  },
])

export function getBrandKit(id: string, version?: number): BrandKit | undefined {
  const kits = BRAND_KITS.filter((kit) => kit.id === id && kit.status === 'published')
  if (version !== undefined) return kits.find((kit) => kit.version === version)
  return kits.sort((a, b) => b.version - a.version)[0]
}

const HEX = /^#[0-9a-f]{6}$/i
const ASSET_ID = /^[a-z0-9][a-z0-9_-]{2,63}$/

export function validateBrandKit(kit: BrandKit): BrandFinding[] {
  const found: BrandFinding[] = []
  const add = (code: string, severity: BrandFinding['severity'], message: string) =>
    void found.push({ code, severity, message })

  if (kit.status !== 'published')
    add('kit_unapproved', 'error', 'Only published brand versions can be used for output.')
  if (!kit.logo) add('logo_missing', 'error', 'The brand kit has no logo or wordmark.')
  else if (!ASSET_ID.test(kit.logo.assetId))
    add('asset_not_registered', 'error', 'Logo must be a registered asset id, not a URL or path.')
  for (const [name, value] of Object.entries(kit.palette))
    if (!HEX.test(value))
      add('palette_invalid', 'error', `Palette colour "${name}" must be #rrggbb.`)
  if (!kit.fonts.length) add('font_missing', 'error', 'The brand kit has no font files.')
  if (kit.fonts.some((font) => font.variable))
    add('font_not_static', 'error', 'Use static font files so the PDF embeds real fonts.')
  if (!Object.values(kit.contact).some(Boolean))
    add(
      'contact_missing',
      'warning',
      'No contact details are configured; contact blocks stay empty.'
    )
  if (!kit.confirmedBy)
    add(
      'brand_unconfirmed',
      'warning',
      'Colours, assets and spelling await marketing confirmation.'
    )
  return found
}

export type SpellingFinding = {
  found: string
  canonical: string
  from: number
  to: number
}

/**
 * Reports glossary variants with ranges. It never rewrites text: other proper
 * names ("Humblebee Farms") are untouched because a variant must match in full.
 */
export function checkBrandSpelling(text: string, kit: BrandKit): SpellingFinding[] {
  const out: SpellingFinding[] = []
  for (const { canonical, variants } of kit.glossary) {
    const pattern = new RegExp(
      `\\b(?:${[canonical, ...variants]
        .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})\\b`,
      'gi'
    )
    for (const match of text.matchAll(pattern))
      if (match[0] !== canonical)
        out.push({
          found: match[0],
          canonical,
          from: match.index,
          to: match.index + match[0].length,
        })
  }
  return out.sort((a, b) => a.from - b.from)
}
