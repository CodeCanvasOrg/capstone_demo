import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { isFigure } from '../../../shared/layout/figure.ts'
import { DESIGNS, isDesign, type DesignId } from '../../../shared/brochure/designs.ts'

const STAT = /^(\S{1,12})\s+—\s+/
const key = new PluginKey('brochurePages')
export const FALLBACK_DESIGN: DesignId = 'article'

/**
 * One A4 sheet of a brochure. The design is not stored on the node: it comes from
 * the entry's pinned page designs, so switching a design restyles the page and never
 * rewrites its text. The node only gives the page a box for the design to compose in.
 */
export const BrochurePage = Node.create<{ getDesigns: () => readonly string[] }>({
  name: 'page',
  content: 'block+',
  defining: true,
  isolating: true,
  addOptions() {
    return { getDesigns: () => [] }
  },
  parseHTML() {
    return [{ tag: 'section[data-brochure-page]' }]
  },
  renderHTML() {
    return ['section', { 'data-brochure-page': '', 'class': 'brochure-page' }, 0]
  },
  addProseMirrorPlugins() {
    const getDesigns = this.options.getDesigns
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const designs = getDesigns()
            const total = state.doc.childCount
            const out: Decoration[] = []
            state.doc.forEach((page, offset, index) => {
              const wanted = designs[index]
              const design = isDesign(wanted) ? wanted : FALLBACK_DESIGN
              let groups = 0
              page.forEach((block) => {
                if (block.type.name === 'heading' && (block.attrs.level as number) >= 3) groups++
              })
              out.push(
                Decoration.node(offset, offset + page.nodeSize, {
                  'data-design': design,
                  'data-label': `Page ${index + 1} of ${total} · ${DESIGNS[design].label}`,
                  'data-first': String(index === 0),
                  'style': `--n:${Math.max(1, Math.min(groups, 4))}`,
                })
              )
              // Blocks after a level-3 heading belong to that card or column.
              let group = -1
              let section = -1
              page.forEach((block, blockOffset) => {
                const level = block.type.name === 'heading' ? (block.attrs.level as number) : 0
                if (level && level <= 2) {
                  section++
                  group = -1
                } else if (level >= 3) group++
                const at = offset + 1 + blockOffset
                // "83% — of executives": the figure is drawn large, the rest is its label.
                const stat = block.type.name === 'paragraph' ? STAT.exec(block.textContent) : null
                if (stat && isFigure(stat[1]))
                  out.push(Decoration.inline(at + 1, at + 1 + stat[1].length, { class: 'pg-fig' }))
                out.push(
                  Decoration.node(at, at + block.nodeSize, {
                    'data-s': String(Math.max(section, 0)),
                    ...(stat && isFigure(stat[1]) ? { 'data-stat': '' } : {}),
                    ...(group >= 0 ? { 'data-g': String(group), 'style': `--g:${group + 1}` } : {}),
                  })
                )
              })
            })
            return DecorationSet.create(state.doc, out)
          },
        },
        view: (view) => {
          const refresh = () => view.dispatch(view.state.tr.setMeta(key, 'refresh'))
          window.addEventListener('brochure-designs', refresh)
          return { destroy: () => window.removeEventListener('brochure-designs', refresh) }
        },
      }),
    ]
  },
})
