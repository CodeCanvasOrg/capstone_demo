import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import {
  columnLayout,
  paginate,
  sectionRoles,
  type Pagination,
} from '../../../shared/layout/pages.ts'

type Measured = Pagination & { padY: number }
const key = new PluginKey<{ pagination: Measured | null; signature: string }>('layoutView')
const A4_RATIO = Math.SQRT2

type ResultMeta = {
  state?: string
  qualifier?: string
  value?: { nodeId?: string; from?: number; to?: number }
}
const EVIDENCE: Record<string, string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
}

/** Labels are drawn by CSS from data-label, so they never become document text. */
const el = (tag: string, className: string, label?: string) => {
  const node = document.createElement(tag)
  node.className = className
  node.setAttribute('aria-hidden', 'true')
  if (label) node.dataset.label = label
  return node
}

/**
 * View-only layout for the editor: A4 pages, the branded section look and
 * evidence badges. It decorates the document and never changes it, so every
 * block stays ordinary, editable TipTap content. Pagination is measured from
 * the rendered blocks; the authoritative page count still comes from the PDF.
 */
export const LayoutView = Extension.create<{ getBudget: () => number | undefined }>({
  name: 'layoutView',
  addOptions() {
    return { getBudget: () => undefined }
  },
  addProseMirrorPlugins() {
    const getBudget = this.options.getBudget
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ pagination: null, signature: '' }),
          apply(tr, value) {
            const meta = tr.getMeta(key) as typeof value | undefined
            return meta ?? value
          },
        },
        props: {
          decorations(state) {
            const { pagination } = key.getState(state)!
            const blocks: { type: string; level?: number; text: string }[] = []
            const offsets: number[] = []
            state.doc.forEach((node, offset) => {
              offsets.push(offset)
              blocks.push({
                type: node.type.name,
                level: node.attrs.level as number | undefined,
                text: node.textContent,
              })
            })
            const roles = sectionRoles(blocks)
            // Challenge and solution share a row only when both are present.
            const paired = new Set<number>()
            for (let i = 0; i < roles.length;) {
              if (roles[i] !== 'challenge' && roles[i] !== 'solution') {
                i++
                continue
              }
              let end = i
              while (
                end < roles.length &&
                (roles[end] === 'challenge' || roles[end] === 'solution')
              )
                end++
              if (new Set(roles.slice(i, end)).size === 2)
                for (let j = i; j < end; j++) paired.add(j)
              i = end
            }
            const decorations: Decoration[] = []
            state.doc.forEach((node, offset, index) => {
              const role = roles[index]
              const classes: string[] = []
              if (role) classes.push(`pm-${role}`)
              if (index === 0 && role === 'hero') classes.push('pm-first')
              // The last block of a run closes its band with padding.
              if (role && roles[index + 1] !== role) classes.push('pm-last')
              if (paired.has(index)) classes.push('pm-col')
              if (classes.length)
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, { class: classes.join(' ') })
                )
            })

            // Stat figures and evidence badges come from the validated metadata.
            const results = (state.doc.attrs.publication?.results ?? []) as ResultMeta[]
            for (const result of results) {
              if (result.state !== 'active' || !result.value?.nodeId) continue
              let found: { offset: number; size: number } | undefined
              state.doc.forEach((node, offset) => {
                if (node.attrs.nodeId === result.value!.nodeId)
                  found = { offset, size: node.nodeSize }
              })
              if (!found) continue
              const from = found.offset + 1 + (result.value.from ?? 0)
              const to = found.offset + 1 + (result.value.to ?? 0)
              if (to > from && to < found.offset + found.size)
                decorations.push(Decoration.inline(from, to, { class: 'stat-figure' }))
              const label = EVIDENCE[result.qualifier ?? '']
              if (label)
                decorations.push(
                  Decoration.widget(
                    found.offset + found.size - 1,
                    () => el('span', 'evidence-badge', label),
                    { side: 1, ignoreSelection: true, key: `ev-${result.value.nodeId}-${label}` }
                  )
                )
            }

            if (pagination) {
              const budget = getBudget()
              for (const pageBreak of pagination.breaks) {
                const at = offsets[pageBreak.before]
                if (at === undefined) continue
                const over = budget !== undefined && pageBreak.page > budget
                decorations.push(
                  Decoration.widget(
                    at,
                    () => {
                      const wrap = el('div', 'page-break')
                      wrap.style.height = `${pageBreak.fill + pagination.padY}px`
                      const gap = el(
                        'div',
                        over ? 'page-gap over' : 'page-gap',
                        over
                          ? `Page ${pageBreak.page}: over the ${budget}-page budget`
                          : `Page ${pageBreak.page}`
                      )
                      gap.style.top = `${pageBreak.fill + pagination.padY / 2 - 14}px`
                      wrap.append(gap)
                      return wrap
                    },
                    {
                      side: -1,
                      ignoreSelection: true,
                      key: `pb-${pageBreak.page}-${Math.round(pageBreak.fill)}-${over}`,
                    }
                  )
                )
              }
              decorations.push(
                Decoration.widget(
                  state.doc.content.size,
                  () => {
                    const over = budget !== undefined && pagination.pages > budget
                    const budgetText = budget === undefined ? '' : ` · budget ${budget}`
                    return el(
                      'div',
                      over ? 'page-end over' : 'page-end',
                      `${pagination.pages} ${pagination.pages === 1 ? 'page' : 'pages'}${budgetText}`
                    )
                  },
                  {
                    side: 1,
                    ignoreSelection: true,
                    key: `end-${pagination.pages}-${budget}-${budget !== undefined && pagination.pages > budget}`,
                  }
                )
              )
            }
            return DecorationSet.create(state.doc, decorations)
          },
        },
        view(initial) {
          let frame = 0
          const measure = (view: EditorView) => {
            frame = 0
            const dom = view.dom as HTMLElement
            const blocks = [...dom.children].filter(
              (child) =>
                !child.classList.contains('page-break') && !child.classList.contains('page-end')
            ) as HTMLElement[]
            if (blocks.length !== view.state.doc.childCount || !dom.clientWidth) return
            const style = getComputedStyle(dom)
            const padY =
              Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
            const pageHeight = dom.clientWidth * A4_RATIO - padY
            const heights = blocks.map((block) => {
              const s = getComputedStyle(block)
              return (
                block.getBoundingClientRect().height +
                Number.parseFloat(s.marginTop || '0') +
                Number.parseFloat(s.marginBottom || '0')
              )
            })
            const keepWithNext: boolean[] = []
            const infos: { type: string; level?: number; text: string }[] = []
            view.state.doc.forEach((node) => {
              keepWithNext.push(node.type.name === 'heading')
              infos.push({
                type: node.type.name,
                level: node.attrs.level as number | undefined,
                text: node.textContent,
              })
            })
            // Side-by-side columns share one row, so measure them as one.
            const columns = columnLayout(sectionRoles(infos), heights)
            const pagination = {
              ...paginate(columns.heights, {
                pageHeight,
                keepWithNext,
                glue: columns.glue,
                budget: getBudget(),
              }),
              padY,
            }
            const signature = JSON.stringify([
              pagination.breaks.map((b) => [b.before, Math.round(b.fill)]),
              pagination.pages,
              pagination.overBudget,
              getBudget(),
              Math.round(padY),
            ])
            if (signature !== key.getState(view.state)!.signature) {
              view.dispatch(view.state.tr.setMeta(key, { pagination, signature }))
              // The status bar lives in React; it only needs numbers, never the document.
              const fontSize = Number.parseFloat(style.fontSize) || 14
              window.dispatchEvent(
                new CustomEvent('layout-stats', {
                  detail: {
                    pages: pagination.pages,
                    budget: getBudget(),
                    lastFill: pagination.lastFill,
                    excess: pagination.excess,
                    lineHeight: Number.parseFloat(style.lineHeight) || fontSize * 1.5,
                  },
                })
              )
            }
          }
          const schedule = (view: EditorView) => {
            if (!frame) frame = requestAnimationFrame(() => measure(view))
          }
          let current = initial
          const observer = new ResizeObserver(() => schedule(current))
          observer.observe(initial.dom)
          const refresh = () => {
            // Force a re-measure and a redraw of the budget-dependent labels.
            const state = key.getState(current.state)!
            current.dispatch(current.state.tr.setMeta(key, { ...state, signature: '' }))
            schedule(current)
          }
          window.addEventListener('layout-budget', refresh)
          schedule(initial)
          return {
            update(view) {
              current = view
              schedule(view)
            },
            destroy() {
              observer.disconnect()
              window.removeEventListener('layout-budget', refresh)
              if (frame) cancelAnimationFrame(frame)
            },
          }
        },
      }),
    ]
  },
})
