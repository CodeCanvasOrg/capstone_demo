import { getBrandKit } from '../../../shared/layout/brand.ts'

export type PreviewDesign = 'case_study' | 'portfolio' | 'technical' | 'vision' | 'freeform'

export type PreviewBlock =
  | 'hero'
  | 'stats'
  | 'cols'
  | 'steps'
  | 'pipeline'
  | 'caps'
  | 'metrics'
  | 'limits'
  | 'roadmap'
  | 'timeline'
  | 'cta'
  | 'sources'
  | 'plain'

export type PreviewSpec = {
  design: PreviewDesign
  palette: {
    primary: string
    accent: string
    accentText: string
    ink: string
    muted: string
    bg: string
    surface: string
  }
  fontName: string
  /** The label above the headline, after the wordmark. */
  kicker: string
  title: string
  length: string
  pages: PreviewBlock[][]
}

const kit = getBrandKit('humblebee')?.palette
const brand = {
  primary: kit?.primary ?? '#111111',
  accent: kit?.accent ?? '#ffb902',
  accentText: kit?.accentText ?? '#946500',
  ink: kit?.text ?? '#111111',
  muted: kit?.muted ?? '#57554f',
  bg: kit?.background ?? '#ffffff',
  surface: kit?.surface ?? '#f2f0e9',
}

/**
 * Each template as it prints. The four company templates use the brand kit and
 * mirror the designs the layout renderer and the editor draw for them;
 * freeform is the plain editor document with no brand styling.
 */
export const PREVIEW_SPECS: Record<string, PreviewSpec> = {
  case_study: {
    design: 'case_study',
    palette: brand,
    fontName: 'Manrope',
    kicker: 'CASE STUDY',
    title: 'Halving review time',
    length: '1–2 pages',
    pages: [
      ['hero', 'stats', 'cols', 'steps'],
      ['caps', 'roadmap', 'cta', 'sources'],
    ],
  },
  portfolio: {
    design: 'portfolio',
    palette: brand,
    fontName: 'Manrope',
    kicker: 'PORTFOLIO',
    title: 'A calmer way to ship',
    length: '1–2 pages',
    pages: [
      ['hero', 'stats', 'cols', 'caps'],
      ['roadmap', 'sources'],
    ],
  },
  technical: {
    design: 'technical',
    palette: brand,
    fontName: 'Manrope',
    kicker: 'TECHNICAL',
    title: 'Streaming at scale',
    length: '1–2 pages',
    pages: [
      ['hero', 'cols', 'pipeline', 'caps'],
      ['metrics', 'limits', 'sources'],
    ],
  },
  vision: {
    design: 'vision',
    palette: brand,
    fontName: 'Manrope',
    kicker: 'PRODUCT VISION',
    title: 'Where we go next',
    length: '1–2 pages',
    pages: [
      ['hero', 'cols', 'steps', 'caps'],
      ['timeline', 'sources'],
    ],
  },
  freeform: {
    design: 'freeform',
    palette: {
      primary: '#111111',
      accent: '#d4d4d8',
      accentText: '#52525b',
      ink: '#111111',
      muted: '#71717a',
      bg: '#ffffff',
      surface: '#f4f4f5',
    },
    fontName: 'Editor default',
    kicker: '',
    title: 'Your own structure',
    length: 'Any length',
    pages: [['plain']],
  },
}

export const specFor = (id: string): PreviewSpec => PREVIEW_SPECS[id] ?? PREVIEW_SPECS.freeform
