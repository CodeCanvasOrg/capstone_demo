import type PublicationContentService from '#services/documents/publication_content_service'
import { deterministicId } from '#services/documents/publication_content_service'
import {
  flattenText,
  type PublicationDocument,
  type PublicationMetadataV1,
} from '../../../shared/publication/content.ts'
import type { EntrySidecar } from '../../../shared/layout/entry.ts'

const SECTION_TYPES: [RegExp, PublicationMetadataV1['sections'][number]['type']][] = [
  [/^key results$/i, 'results'],
  [/^the challenge$/i, 'challenge'],
  [/^the solution$/i, 'solution'],
  [/^key capabilities$/i, 'capabilities'],
]

/**
 * Adds what only the structured entry knows to the mapped publication metadata:
 * each result with its evidence label, units and footnote text; the claim that
 * backs it; private reviewer notes; and the section types. Identity is derived
 * from the task namespace, so a replayed task yields the same ids. A result
 * whose paragraph can no longer be found becomes a reviewer note, never a
 * silently dropped number.
 */
export default class BrandedEntryService {
  apply(
    service: PublicationContentService,
    document: PublicationDocument,
    sidecar: EntrySidecar,
    namespace: string
  ): PublicationDocument {
    const meta = document.attrs?.publication as PublicationMetadataV1
    const refByChunk = new Map((meta.references ?? []).map((ref) => [ref.chunkId, ref.id]))
    const notes = [...sidecar.notes]
    const claims: NonNullable<PublicationMetadataV1['claims']> = []
    const results: NonNullable<PublicationMetadataV1['results']> = []
    const taken = new Set<number>()

    sidecar.results.forEach((result, i) => {
      const at = document.content.findIndex(
        (node, index) =>
          !taken.has(index) && node.type === 'paragraph' && flattenText(node) === result.text
      )
      if (at < 0) {
        notes.push(`Result "${result.text.slice(0, 80)}" could not be attached to the text.`)
        return
      }
      taken.add(at)
      const nodeId = String(document.content[at].attrs!.nodeId)
      const claimId = deterministicId(`${namespace}:claim:${i}`)
      claims.push({
        id: claimId,
        state: 'active',
        text: service.anchor(document, nodeId, 0, result.text.length),
        authorship: 'ai',
        evidenceRefIds: result.chunkIds
          .map((chunk) => refByChunk.get(chunk))
          .filter((id): id is string => !!id),
      })
      results.push({
        id: deterministicId(`${namespace}:result:${i}`),
        state: 'active',
        claimId,
        value: service.anchor(document, nodeId, 0, result.valueLength),
        qualifier: result.qualifier,
        ...(result.comparison ? { comparison: result.comparison } : {}),
        units: result.units,
        ...(result.methodology ? { methodology: result.methodology } : {}),
      })
    })

    const byId = new Map(document.content.map((node) => [node.attrs?.nodeId, node]))
    for (const section of meta.sections) {
      const heading = section.heading ? byId.get(section.heading.nodeId) : undefined
      const name = heading ? flattenText(heading).trim() : ''
      const type = SECTION_TYPES.find(([pattern]) => pattern.test(name))?.[1]
      if (type) section.type = type
    }
    if (claims.length) meta.claims = [...(meta.claims ?? []), ...claims]
    if (results.length) meta.results = [...(meta.results ?? []), ...results]
    if (notes.length)
      meta.reviewerNotes = notes.map((message, i) => ({
        id: deterministicId(`${namespace}:note:${i}`),
        message,
      }))
    return document
  }
}
