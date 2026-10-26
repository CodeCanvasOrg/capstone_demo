import { Exception } from '@adonisjs/core/exceptions'
import { getStructuredOutput } from '#services/structured_model_output_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

export default class ContentService {
  normalize(value: unknown): TipTapDocument {
    const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
    let count = 0
    while (stack.length) {
      const item = stack.pop()!
      if (item.depth > 50 || ++count > 50000)
        throw new Exception('Document is too deeply nested', { status: 422 })
      if (item.value && typeof item.value === 'object')
        for (const child of Object.values(item.value))
          stack.push({ value: child, depth: item.depth + 1 })
    }
    if (JSON.stringify(value).length > 2000000)
      throw new Exception('Document is too large', { status: 422 })
    const result = getStructuredOutput({ editor: true }).safeParse(value)
    if (!result.success)
      throw new Exception('Invalid document content', { status: 422, code: 'E_INVALID_CONTENT' })
    const document = result.data as TipTapDocument
    const visit = (node: TipTapDocument['content'][number], depth = 0) => {
      if (depth > 50) throw new Exception('Document is too deeply nested', { status: 422 })
      for (const mark of node.marks ?? []) {
        const item = mark as { type: string; attrs?: Record<string, unknown> }
        if (item.type === 'link') {
          const href = String(item.attrs?.href ?? '')
          if (!/^(https?:\/\/|mailto:)/i.test(href))
            throw new Exception('Unsupported link protocol', { status: 422 })
          item.attrs = { href, target: '_blank', rel: 'noopener noreferrer' }
        } else delete item.attrs
      }
      node.content?.forEach((child) => visit(child, depth + 1))
    }
    document.content.forEach((node) => visit(node))
    return document
  }
}
