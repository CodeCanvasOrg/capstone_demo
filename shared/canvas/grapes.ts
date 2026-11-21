import { clampGeo, parseLength } from './geometry.ts'
import { frameCss, sheetCss, type CssUnits } from './css.ts'
import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type Frame,
  type Geo,
  type Sheet,
} from './model.ts'

/**
 * The edge between the stored canvas and the GrapesJS editor, in both
 * directions, as plain JSON. Each sheet and frame becomes a component of our
 * own type (`cv-sheet`, `cv-text`, ...) carrying its stored data in a `cv`
 * property; CSS is only for display. Reading back takes the `cv` data, plus the
 * position GrapesJS wrote while dragging. The result is a candidate only: the
 * caller must pass it through parseCanvas. Browser-safe, no GrapesJS import.
 */
export const PAGE_ID = 'canvas'
export const SHEET_TYPE = 'cv-sheet'
export const frameType = (kind: Frame['kind']) => `cv-${kind}`

type StyleMap = Record<string, string>
export type GrapesComponent = {
  type?: string
  attributes?: Record<string, unknown>
  components?: GrapesComponent[]
  style?: StyleMap
  cv?: Record<string, unknown>
  [key: string]: unknown
}
type GrapesRule = { selectors?: (string | { name?: string; type?: number })[]; style?: StyleMap }
type GrapesPage = {
  id?: string
  component?: GrapesComponent | string
  /** How GrapesJS saves a page: its tree sits in the first frame. */
  frames?: { component?: GrapesComponent | string }[]
}
export type GrapesProject = {
  pages?: GrapesPage[]
  styles?: GrapesRule[]
  [key: string]: unknown
}

/** `px` for the live editor (see geoCssPx); `mm` everywhere else. */
export const frameComponent = (frame: Frame, units: CssUnits = 'mm'): GrapesComponent => ({
  type: frameType(frame.kind),
  attributes: { id: frame.id },
  classes: ['cv-frame', `cv-${frame.kind}`],
  style: frameCss(frame, units),
  cv: structuredClone(frame) as unknown as Record<string, unknown>,
})

export const sheetComponent = (sheet: Sheet, units: CssUnits = 'mm'): GrapesComponent => ({
  type: SHEET_TYPE,
  attributes: { id: sheet.id },
  classes: ['cv-sheet'],
  style: sheetCss(sheet),
  cv: { id: sheet.id, background: sheet.background },
  components: sheet.frames.map((frame) => frameComponent(frame, units)),
})

export function toGrapes(canvas: CanvasDocument, units: CssUnits = 'mm'): GrapesProject {
  return {
    assets: [],
    styles: [],
    pages: [
      {
        id: PAGE_ID,
        component: {
          type: 'wrapper',
          components: canvas.sheets.map((sheet) => sheetComponent(sheet, units)),
        },
      },
    ],
  }
}

/** Styles GrapesJS keeps for an element: its own style plus any `#id` rule. */
function stylesFor(cmp: GrapesComponent, rules: Map<string, StyleMap>): StyleMap {
  const id = cmp.attributes?.id
  return { ...(typeof id === 'string' ? rules.get(id) : undefined), ...cmp.style }
}

function idRules(project: GrapesProject) {
  const rules = new Map<string, StyleMap>()
  for (const rule of project.styles ?? []) {
    if (rule.selectors?.length !== 1 || !rule.style) continue
    const [selector] = rule.selectors
    const name =
      typeof selector === 'string'
        ? selector.startsWith('#')
          ? selector.slice(1)
          : null
        : selector.type === 2 // GrapesJS selector type 2 is an id
          ? (selector.name ?? null)
          : null
    if (name) rules.set(name, { ...rules.get(name), ...rule.style })
  }
  return rules
}

/** The position GrapesJS wrote while dragging or resizing, or the stored one. */
export function geoFrom(style: StyleMap, stored: unknown): Geo {
  const fallback = (stored ?? {}) as Partial<Geo>
  const read = (key: string, axis: 'w' | 'h', current: number | undefined) =>
    parseLength(style[key], axis) ?? current ?? 0
  return clampGeo({
    x: read('left', 'w', fallback.x),
    y: read('top', 'h', fallback.y),
    w: read('width', 'w', fallback.w),
    h: read('height', 'h', fallback.h),
  })
}

export function fromGrapes(project: GrapesProject): unknown {
  const rules = idRules(project)
  const page = project.pages?.find((p) => p.id === PAGE_ID) ?? project.pages?.[0]
  const root = page?.component ?? page?.frames?.[0]?.component
  const wrapper = typeof root === 'object' ? root : undefined
  const sheets = (wrapper?.components ?? [])
    .filter((cmp) => cmp.type === SHEET_TYPE)
    .map((cmp): Partial<Sheet> => ({
      ...(cmp.cv as Partial<Sheet>),
      frames: (cmp.components ?? [])
        .filter(
          (child) => typeof child.type === 'string' && child.type.startsWith('cv-') && child.cv
        )
        .map((child) => {
          const style = stylesFor(child, rules)
          const z = Number.parseInt(style['z-index'] ?? '', 10)
          return {
            ...child.cv,
            geo: geoFrom(style, child.cv?.geo),
            ...(Number.isFinite(z) ? { z } : {}),
          } as Frame
        }),
    }))
  return { schemaVersion: CANVAS_SCHEMA_VERSION, sheets }
}
