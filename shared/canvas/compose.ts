import { isFigure } from '../layout/figure.ts'
import type { DesignId } from '../brochure/designs.ts'
import {
  CANVAS_SCHEMA_VERSION,
  SHEET,
  type CanvasDocument,
  type Frame,
  type FrameStyle,
  type Geo,
  type Sheet,
  type TipTapBlock,
} from './model.ts'

/**
 * Lays a text-only brochure out as a canvas: one sheet per page, frames placed
 * by the page's design. This is how an existing document opens in the canvas
 * editor and how generated content gets a layout; the model never writes canvas
 * data. The page's own nodes are moved into frames unchanged (citations, links
 * and images included) and nothing is dropped: whatever a design has no slot for
 * joins the page's main text frame. Deterministic. Browser-safe.
 */

type Section = {
  title?: TipTapBlock
  intro: TipTapBlock[]
  stat?: { value: string; label: string; node: TipTapBlock }
  groups: { heading: TipTapBlock; nodes: TipTapBlock[] }[]
  source?: TipTapBlock
}

const STAT = /^(\S{1,12})\s+—\s+/
const SOURCE = /^Source:\s*/i

const textOf = (node: TipTapBlock): string =>
  node.type === 'text'
    ? String(node.text ?? '')
    : ((node.content as TipTapBlock[] | undefined) ?? []).map(textOf).join('')

const level = (node: TipTapBlock) =>
  node.type === 'heading' ? Number((node.attrs as { level?: number } | undefined)?.level ?? 1) : 0

function statOf(node: TipTapBlock) {
  if (node.type !== 'paragraph') return null
  // Only plain text becomes a figure: a citation or link must stay in a text frame.
  const inline = (node.content as TipTapBlock[] | undefined) ?? []
  if (
    inline.some((child) => child.type !== 'text' || (child.marks as unknown[] | undefined)?.length)
  )
    return null
  const text = textOf(node)
  const match = STAT.exec(text)
  return match && isFigure(match[1])
    ? { value: match[1], label: text.slice(match[0].length).trim() }
    : null
}

export function splitSheets(doc: { content?: TipTapBlock[] } | null | undefined): TipTapBlock[][] {
  const pages: TipTapBlock[][] = [[]]
  for (const node of doc?.content ?? []) {
    if (node.type === 'horizontalRule') pages.push([])
    else pages.at(-1)!.push(node)
  }
  return pages.filter((page, i) => page.length || i === 0)
}

export function sectionsOf(nodes: TipTapBlock[]): Section[] {
  const sections: Section[] = []
  let current: Section | undefined
  let group: Section['groups'][number] | undefined
  const ensure = () => (current ??= sections[sections.push({ intro: [], groups: [] }) - 1])
  for (const node of nodes) {
    const l = level(node)
    if (l && l <= 2) {
      current = undefined
      group = undefined
      ensure().title = node
    } else if (l) {
      group = { heading: node, nodes: [] }
      ensure().groups.push(group)
    } else if (node.type === 'paragraph' && SOURCE.test(textOf(node)) && !ensure().source) {
      ensure().source = node
    } else if (group) {
      group.nodes.push(node)
    } else {
      const section = ensure()
      const stat = !section.stat && !section.groups.length ? statOf(node) : null
      if (stat) section.stat = { ...stat, node }
      else section.intro.push(node)
    }
  }
  return sections.length ? sections : [{ intro: [], groups: [] }]
}

/** Folds sections past what a design shows into its last one, so nothing is lost. */
function fit(sections: Section[], count: number): Section[] {
  if (sections.length <= count) return sections
  const kept = sections
    .slice(0, count)
    .map((s) => ({ ...s, intro: [...s.intro], groups: [...s.groups] }))
  const last = kept[count - 1]
  for (const extra of sections.slice(count)) {
    last.groups.push(
      ...(extra.title ? [{ heading: extra.title, nodes: [...extra.intro] }] : []),
      ...extra.groups
    )
    if (!extra.title) last.intro.push(...extra.intro)
    if (extra.stat) last.intro.push(extra.stat.node)
    if (extra.source) last.intro.push(extra.source)
  }
  return kept
}

const groupNodes = (groups: Section['groups']) => groups.flatMap((g) => [g.heading, ...g.nodes])

class SheetBuilder {
  frames: Frame[] = []
  private n = 0
  constructor(
    readonly id: string,
    readonly background: Sheet['background']
  ) {}

  private next() {
    const i = this.n++
    return { id: `${this.id}-f${i}`, z: i, order: i }
  }

  text(geo: Geo, nodes: (TipTapBlock | undefined)[], style: FrameStyle = {}) {
    const doc = nodes.filter((n): n is TipTapBlock => !!n)
    if (!doc.length) return
    this.frames.push({ ...this.next(), kind: 'text', geo, style, doc })
  }

  figure(geo: Geo, stat: { value: string; label: string } | undefined, style: FrameStyle = {}) {
    if (!stat) return
    this.frames.push({
      ...this.next(),
      kind: 'figure',
      geo,
      style,
      value: stat.value,
      label: stat.label,
    })
  }

  shape(geo: Geo, fill: FrameStyle['fill'], shape: 'rect' | 'hex' = 'rect') {
    this.frames.push({ ...this.next(), kind: 'shape', geo, style: { fill }, shape })
  }

  art(geo: Geo, art: 'ribbons' | 'glow') {
    this.frames.push({ ...this.next(), kind: 'art', geo, style: {}, art })
  }

  build(): Sheet {
    return { id: this.id, background: this.background, frames: this.frames }
  }
}

const M = 180 // 18 mm margin
const W = SHEET.w - 2 * M
const g = (x: number, y: number, w: number, h: number): Geo => ({ x, y, w, h })

/** Even columns across `width` starting at `x`, with a 6 mm gutter. */
const columns = (n: number, x = M, width = W, gap = 60) => {
  const w = Math.floor((width - gap * (n - 1)) / Math.max(n, 1))
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (w + gap), w }))
}

const WHITE: FrameStyle = { color: 'white' }
const TITLE: FrameStyle = { font: 'xl', weight: 800, color: 'primary' }
const SMALL: FrameStyle = { font: 'xs', color: 'muted' }

type Layout = (b: SheetBuilder, sections: Section[]) => void

/** Leftover stat of a design that has no figure slot goes back into the text. */
const withStat = (s: Section) => (s.stat ? [s.stat.node, ...s.intro] : s.intro)

const LAYOUTS: Record<
  DesignId,
  { sections: number; background: Sheet['background']; place: Layout }
> = {
  cover: {
    sections: 1,
    background: 'primary',
    place(b, [s]) {
      b.art(g(0, 0, SHEET.w, SHEET.h), 'ribbons')
      b.text(g(M, 1300, 1600, 800), [s.title], {
        ...WHITE,
        font: 'xxl',
        weight: 800,
        valign: 'bottom',
      })
      b.text(g(M, 2150, 1300, 500), [...withStat(s), ...groupNodes(s.groups), s.source], {
        ...WHITE,
        font: 'lg',
      })
    },
  },
  proof: {
    sections: 1,
    background: 'white',
    place(b, [s]) {
      b.shape(g(0, 0, 900, SHEET.h), 'primary')
      b.text(g(150, 300, 650, 2300), [s.title, ...s.intro], { ...WHITE, font: 'lg' })
      b.figure(g(1050, 150, 900, 300), s.stat, {
        font: 'display',
        weight: 800,
        color: 'accentText',
      })
      s.groups.slice(0, 3).forEach((group, i) => {
        const y = 450 + i * 700
        const [first, ...rest] = group.nodes
        const stat = first ? statOf(first) : null
        b.figure(g(1050, y, 900, 250), stat ?? undefined, {
          font: 'display',
          weight: 800,
          color: 'accentText',
        })
        b.text(g(1050, y + 270, 900, 400), [group.heading, ...(stat ? rest : group.nodes)])
      })
      b.text(g(1050, 2540, 900, 200), groupNodes(s.groups.slice(3)))
      b.text(g(150, 2780, 1800, 120), [s.source], SMALL)
    },
  },
  article: {
    sections: 1,
    background: 'white',
    place(b, [s]) {
      b.text(g(M, 250, W, 350), [s.title], TITLE)
      b.shape(g(M, 640, 300, 20), 'accent')
      b.text(g(M, 720, s.groups.length ? 1100 : W, 2050), [...withStat(s)])
      if (s.groups.length)
        b.text(g(1380, 720, 540, 2050), groupNodes(s.groups), { fill: 'surface', padding: 50 })
      b.text(g(M, 2800, W, 100), [s.source], SMALL)
    },
  },
  offer: {
    sections: 2,
    background: 'white',
    place(b, [s, t]) {
      b.shape(g(0, 0, SHEET.w, 1100), 'primary')
      b.text(g(M, 250, 1250, 800), [s.title, ...s.intro, s.source], { ...WHITE, font: 'lg' })
      b.figure(g(1500, 650, 450, 650), s.stat, { font: 'display', weight: 800, color: 'accent' })
      b.text(g(M, 1350, 1250, 400), [...groupNodes(s.groups)])
      if (!t) return
      b.text(g(M, 1350 + (s.groups.length ? 450 : 0), W, 150), [t.title], TITLE)
      const cols = columns(Math.min(Math.max(t.groups.length, 1), 3))
      t.groups
        .slice(0, 3)
        .forEach((group, i) =>
          b.text(g(cols[i].x, 1600, cols[i].w, 1250), [group.heading, ...group.nodes])
        )
      b.text(g(M, 2700, W, 200), [...withStat(t), ...groupNodes(t.groups.slice(3)), t.source])
    },
  },
  glance: {
    sections: 3,
    background: 'white',
    place(b, [s, t, u]) {
      b.text(g(M, 200, W, 300), [s.title, ...withStat(s), ...groupNodes(s.groups), s.source], TITLE)
      if (t) {
        b.text(g(M, 550, W, 250), [t.title, ...withStat(t), t.source])
        const n = Math.min(Math.max(t.groups.length, 1), 4)
        const cols = columns(n)
        t.groups.slice(0, 4).forEach((group, i) =>
          b.text(g(cols[i].x, 850, cols[i].w, 1000), [group.heading, ...group.nodes], {
            fill: 'surface',
            padding: 50,
            radius: 30,
          })
        )
        b.text(g(M, 1870, W, 60), groupNodes(t.groups.slice(4)))
      }
      if (u) {
        b.shape(g(0, 2000, SHEET.w, 970), 'primary')
        b.text(
          g(M, 2080, W, 820),
          [u.title, ...withStat(u), ...groupNodes(u.groups), u.source],
          WHITE
        )
      }
    },
  },
  columns: {
    sections: 2,
    background: 'white',
    place(b, [s, t]) {
      b.shape(g(0, 0, SHEET.w, 900), 'primary')
      b.text(g(M, 200, W, 650), [s.title, ...withStat(s), ...groupNodes(s.groups), s.source], {
        ...WHITE,
        font: 'lg',
      })
      if (!t) return
      b.text(g(M, 1050, W, 250), [t.title, ...withStat(t)], TITLE)
      const cols = columns(Math.min(Math.max(t.groups.length, 1), 3))
      t.groups
        .slice(0, 3)
        .forEach((group, i) =>
          b.text(g(cols[i].x, 1350, cols[i].w, 1350), [group.heading, ...group.nodes])
        )
      b.text(g(M, 2750, W, 150), [...groupNodes(t.groups.slice(3)), t.source])
    },
  },
  insight: {
    sections: 1,
    background: 'white',
    place(b, [s]) {
      b.shape(g(1400, 0, 700, SHEET.h), 'primary')
      b.art(g(1400, 0, 700, SHEET.h), 'glow')
      b.text(g(M, 200, 1120, 300), [s.title, ...withStat(s)], TITLE)
      const cols = columns(Math.min(Math.max(s.groups.length, 1), 3), M, 1120)
      s.groups
        .slice(0, 3)
        .forEach((group, i) =>
          b.text(g(cols[i].x, 550, cols[i].w, 2150), [group.heading, ...group.nodes])
        )
      b.text(g(M, 2720, 1120, 180), [...groupNodes(s.groups.slice(3)), s.source])
    },
  },
  recognition: {
    sections: 1,
    background: 'white',
    place(b, [s]) {
      b.text(g(M, 250, W, 500), [s.title], { ...TITLE, font: 'display' })
      b.text(g(M, 800, W, 450), [...withStat(s)], { font: 'lg' })
      const cols = columns(3)
      s.groups.slice(0, 6).forEach((group, i) => {
        const col = cols[i % 3]
        b.text(
          g(col.x, 1350 + Math.floor(i / 3) * 680, col.w, 600),
          [group.heading, ...group.nodes],
          {
            fill: 'surface',
            padding: 50,
            radius: 30,
          }
        )
      })
      b.text(g(M, 2720, W, 180), [...groupNodes(s.groups.slice(6)), s.source])
    },
  },
  contact: {
    sections: 1,
    background: 'primary',
    place(b, [s]) {
      b.art(g(0, 0, SHEET.w, SHEET.h), 'glow')
      b.text(g(M, 1100, W, 400), [s.title], { ...WHITE, font: 'xxl', weight: 800 })
      b.text(g(M, 1550, W, 1200), [...withStat(s), ...groupNodes(s.groups), s.source], {
        ...WHITE,
        font: 'lg',
      })
    },
  },
}

export function composeSheet(nodes: TipTapBlock[], design: DesignId, index: number): Sheet {
  const layout = LAYOUTS[design]
  const builder = new SheetBuilder(`s${index}`, layout.background)
  layout.place(builder, fit(sectionsOf(nodes), layout.sections))
  return builder.build()
}

/** The stored flat document and its page designs (one per page, already resolved). */
export function composeCanvas(
  doc: { content?: TipTapBlock[] } | null | undefined,
  designs: readonly DesignId[],
  fallback: DesignId = 'article'
): CanvasDocument {
  const pages = splitSheets(doc)
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    sheets: pages.map((nodes, i) => composeSheet(nodes, designs[i] ?? fallback, i)),
  }
}
