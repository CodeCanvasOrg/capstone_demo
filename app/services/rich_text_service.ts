import ContentService from '#services/documents/content_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import { Exception } from '@adonisjs/core/exceptions'
/** Normalize descriptions as a safe editor document and derive their searchable/model text. */
export default class RichTextService {
  description(value: unknown, maximum = 20000) {
    const content = new ContentService().normalize(value)
    const text = (node: TipTapDocument['content'][number]): string => {
      if (['image', 'sourceCitation'].includes(node.type))
        throw new Exception('Descriptions cannot contain evidence nodes', { status: 422 })
      return (
        node.text ??
        (node.type === 'hardBreak'
          ? '\n'
          : (node.content ?? [])
              .map(text)
              .join(node.type === 'paragraph' || node.type === 'heading' ? '' : '\n'))
      )
    }
    const description = content.content.map(text).join('\n').trim()
    if (description.length > maximum)
      throw new Exception(`Description must be at most ${maximum} characters`, { status: 422 })
    return { description: description || null, descriptionContent: content }
  }
}
