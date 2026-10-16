import { getSchema } from '@tiptap/core'
import { Exception } from '@adonisjs/core/exceptions'
import RichTextService from '#services/rich_text_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import {
  informationFields,
  informationSectionName,
  projectInformationExtensions,
} from '../../../shared/project_information.ts'

const schema = getSchema(projectInformationExtensions())
export default class ProjectInformationService {
  normalize(value: unknown) {
    const invalid = () => new Exception('Invalid project information document', { status: 422 })
    if (!value || typeof value !== 'object') throw invalid()
    const doc = value as TipTapDocument
    if (
      doc.type !== 'doc' ||
      !Array.isArray(doc.content) ||
      doc.content.length !== informationFields.length
    )
      throw invalid()
    const information: Record<string, string> = {}
    const content = informationFields.map(([key], index) => {
      const section = doc.content[index]
      if (
        section?.type !== informationSectionName(key) ||
        !Array.isArray(section.content) ||
        !section.content.length
      )
        throw invalid()
      const normalized = new RichTextService().description({
        type: 'doc',
        content: section.content,
      })
      information[key] = normalized.description ?? ''
      return { type: informationSectionName(key), content: normalized.descriptionContent.content }
    })
    const normalized: TipTapDocument = { type: 'doc', content }
    try {
      // ContentService validates safe nodes/links; the editor schema also enforces nesting.
      schema.nodeFromJSON(normalized).check()
    } catch {
      throw invalid()
    }
    return { projectInformation: information, projectInformationContent: normalized }
  }
}
