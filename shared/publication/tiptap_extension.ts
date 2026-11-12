import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { IDENTIFIED_BLOCKS } from './content.ts'

const BLOCKS = [...IDENTIFIED_BLOCKS]

/**
 * Carries the server-owned publication metadata (`doc.attrs.publication`) and
 * stable block identity (`attrs.nodeId`) through the editor so `getJSON()`
 * returns them unchanged. The browser never mints IDs: when a split or paste
 * copies one, the later copy is cleared and the server allocates a new ID.
 */
export const PublicationMetadata = Extension.create({
  name: 'publicationMetadata',
  addGlobalAttributes() {
    return [
      { types: ['doc'], attributes: { publication: { default: null, rendered: false } } },
      {
        types: BLOCKS,
        attributes: {
          nodeId: {
            default: null,
            // Lets error summaries focus a block; never parsed back from pasted HTML.
            parseHTML: () => null,
            renderHTML: (attributes) =>
              typeof attributes.nodeId === 'string' ? { 'data-node-id': attributes.nodeId } : {},
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('publicationNodeIds'),
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          const seen = new Set<string>()
          const tr = state.tr
          state.doc.descendants((node, pos) => {
            const id = node.attrs.nodeId
            if (typeof id !== 'string') return
            if (seen.has(id)) tr.setNodeAttribute(pos, 'nodeId', null)
            else seen.add(id)
          })
          return tr.docChanged ? tr : null
        },
      }),
    ]
  },
})
