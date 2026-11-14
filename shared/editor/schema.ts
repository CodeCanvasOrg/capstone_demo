import { Node, getSchema } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { PublicationMetadata } from '../publication/tiptap_extension.ts'

/** Links the editor may create and the server will store. Everything else is dropped. */
const LINK_PATTERN = /^(https?:\/\/|mailto:)/i
export const isAllowedLinkHref = (href: unknown): href is string =>
  typeof href === 'string' && LINK_PATTERN.test(href.trim())

export const HEADING_LEVELS = [1, 2, 3, 4] as const

/** Evidence metadata a node carries from the retrieval pipeline; never rendered to HTML. */
const hidden = (names: string[]) =>
  Object.fromEntries(names.map((name) => [name, { default: null, renderHTML: () => ({}) }]))

/** Structure and attributes of the inline citation. The browser adds the node view. */
export const SourceCitationNode = Node.create({
  name: 'sourceCitation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      sourceChunkId: {
        default: null,
        parseHTML: (element: { getAttribute(name: string): string | null }) =>
          element.getAttribute('data-source-chunk-id'),
        renderHTML: (attributes) => ({ 'data-source-chunk-id': attributes.sourceChunkId }),
      },
      ...hidden(['chunkText', 'fileName', 'fileUrl', 'mediaType', 'chunkIndex', 'pageNumber']),
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-source-citation]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      { ...HTMLAttributes, 'data-source-citation': 'true', 'class': 'tiptap-source-citation' },
      String(node.attrs.fileName || 'Source'),
    ]
  },
})

/** Structure and attributes of document images. The browser adds the node view. */
export const DocumentImageNode = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: '100%' },
      height: { default: null },
      align: { default: 'center' },
      ...hidden([
        'sourceChunkId',
        'documentImageId',
        'chunkText',
        'fileName',
        'fileUrl',
        'mediaType',
        'chunkIndex',
        'pageNumber',
      ]),
    }
  },
})

/**
 * The one definition of the document format. The editor extends these with
 * views and UI extensions; the server validates saved and generated content
 * against `getSchema(...)` of the same list, so the two cannot drift.
 */
export const documentExtensions = (
  nodes = { sourceCitation: SourceCitationNode, image: DocumentImageNode }
) => [
  StarterKit.configure({
    heading: { levels: [...HEADING_LEVELS] },
    link: {
      autolink: true,
      openOnClick: false,
      defaultProtocol: 'https',
      protocols: ['mailto'],
      isAllowedUri: (url, context) => context.defaultValidate(url) && isAllowedLinkHref(url),
    },
  }),
  nodes.sourceCitation,
  nodes.image,
  PublicationMetadata,
]

let cached: ReturnType<typeof getSchema> | undefined
export const documentSchema = () => (cached ??= getSchema(documentExtensions()))
