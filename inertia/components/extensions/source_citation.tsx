import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Node, mergeAttributes } from '@tiptap/core'
import { ExternalLink, FileText } from 'lucide-react'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'

export const SourceCitation = Node.create({
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
      chunkText: { default: null, renderHTML: () => ({}) },
      fileName: { default: null, renderHTML: () => ({}) },
      fileUrl: { default: null, renderHTML: () => ({}) },
      mediaType: { default: null, renderHTML: () => ({}) },
      chunkIndex: { default: null, renderHTML: () => ({}) },
      pageNumber: { default: null, renderHTML: () => ({}) },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-source-citation]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const chunkNumber =
      typeof node.attrs.chunkIndex === 'number' ? ` · chunk ${node.attrs.chunkIndex + 1}` : ''
    const page = typeof node.attrs.pageNumber === 'number' ? ` · page ${node.attrs.pageNumber}` : ''
    const attributes = mergeAttributes(HTMLAttributes, {
      'data-source-citation': 'true',
      'class': 'tiptap-source-citation',
    })
    const label = `${node.attrs.fileName || 'Source'}${chunkNumber}${page}`

    if (typeof node.attrs.fileUrl === 'string') {
      return [
        'a',
        {
          ...attributes,
          href: node.attrs.fileUrl,
          target: '_blank',
          rel: 'noreferrer',
        },
        label,
      ]
    }

    return ['span', attributes, label]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SourceCitationView)
  },
})

function SourceCitationView({ node }: NodeViewProps) {
  const { chunkIndex, chunkText, fileName, fileUrl, mediaType, pageNumber } = node.attrs
  const label = typeof fileName === 'string' && fileName ? fileName : 'Source'
  const isImage = typeof mediaType === 'string' && mediaType.startsWith('image/')

  return (
    <NodeViewWrapper as="span" className="mx-0.5 inline align-baseline" contentEditable={false}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="align-baseline font-normal"
            aria-label={`Show source excerpt from ${label}`}
          >
            <FileText />
            <span className="max-w-36 truncate">{label}</span>
            {typeof chunkIndex === 'number' && <span>· {chunkIndex + 1}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium" title={label}>
              {label}
            </p>
            <p className="text-xs text-muted-foreground">
              {typeof pageNumber === 'number' ? `Page ${pageNumber}` : 'Source excerpt'}
              {typeof chunkIndex === 'number' ? ` · Chunk ${chunkIndex + 1}` : ''}
            </p>
          </div>
          {isImage && typeof fileUrl === 'string' && (
            <img
              src={fileUrl}
              alt={label}
              className="max-h-48 w-full rounded-lg border border-border object-contain"
            />
          )}
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
            {typeof chunkText === 'string' && chunkText
              ? chunkText
              : 'No text was extracted from this source.'}
          </div>
          {typeof fileUrl === 'string' && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open source
              <ExternalLink className="size-3" />
            </a>
          )}
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  )
}
