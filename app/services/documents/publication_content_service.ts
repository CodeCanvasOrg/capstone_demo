import { createHash } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import {
  ENABLED_DOC_TYPES,
  IDENTIFIED_BLOCKS,
  PUBLICATION_FIELD_PREFIX,
  PUBLICATION_SCHEMA_VERSION,
  TEXT_BLOCKS,
  flattenText,
  publicationSchema,
  toFieldErrors,
  type FieldError,
  type PublicationDocument,
  type PublicationMetadataV1,
  type PublicationNode,
  type TextRef,
} from '../../../shared/publication/content.ts'

type Claim = NonNullable<PublicationMetadataV1['claims']>[number]
type Result = NonNullable<PublicationMetadataV1['results']>[number]
type ResultActive = Extract<Result, { state: 'active' }>
type UnresolvedReason = Extract<Claim, { state: 'needs_review' }>['reason']

/**
 * Server-resolved resources. Callers pass only what the actor may use; an
 * absent resolver skips that check (structure-only validation).
 */
export type PublicationResolvers = {
  chunks?: ReadonlySet<string>
  assets?: ReadonlySet<string>
}

export type PublicationDiagnostic = { code: string; id?: string; nodeId?: string }

export type PublicationPatch =
  | { type: 'replaceText'; target: 'hero.title' | 'hero.summary'; text: string }
  | {
      type: 'setResultContext'
      resultId: string
      qualifier?: ResultActive['qualifier']
      comparison?: ResultActive['comparison'] | null
      units?: string | null
      scope?: string | null
      baseline?: string | null
      period?: string | null
      methodology?: string | null
    }
  | { type: 'upsertNote'; id?: string; nodeId?: string; message: string }
  | { type: 'removeNote'; id: string }

export type PublicationIdentity = { sourceVersionId: string; contentHash: string }

export type LegacyMappingReport = {
  mapped: boolean
  identitiesAssigned: number
  preservedNodes: number
  unresolved: PublicationDiagnostic[]
}

export function publicationError(errors: FieldError[]) {
  const error = new Exception('Check the highlighted content fields.', {
    status: 422,
    code: 'E_PUBLICATION_CONTENT',
  })
  Object.assign(error, { messages: errors })
  return error
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** RFC 4122 v5-style ID: same seed, same ID; no randomness. */
export function deterministicId(seed: string) {
  const bytes = createHash('sha1').update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function textHash(text: string) {
  return sha256(text)
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}

const clone = <T>(value: T): T => structuredClone(value)

function walk(
  nodes: PublicationNode[] | undefined,
  visit: (node: PublicationNode, path: string) => void,
  prefix = ''
) {
  nodes?.forEach((node, index) => {
    const path = prefix ? `${prefix}.${index}` : String(index)
    visit(node, path)
    walk(node.content, visit, path)
  })
}

function indexNodes(document: PublicationDocument) {
  const nodes = new Map<string, PublicationNode>()
  const duplicates: string[] = []
  walk(document.content, (node) => {
    const id = node.attrs?.nodeId
    if (typeof id !== 'string') return
    if (nodes.has(id)) duplicates.push(id)
    else nodes.set(id, node)
  })
  return { nodes, duplicates }
}

function anchorState(nodes: Map<string, PublicationNode>, ref: TextRef): 'ok' | UnresolvedReason {
  const node = nodes.get(ref.nodeId)
  if (!node || !TEXT_BLOCKS.has(node.type)) return 'node_removed'
  const text = flattenText(node)
  if (ref.from >= ref.to || ref.to > text.length) return 'range_out_of_bounds'
  return textHash(text.slice(ref.from, ref.to)) === ref.textHash ? 'ok' : 'text_changed'
}

export default class PublicationContentService {
  contentHash(document: PublicationDocument) {
    return sha256(stable(document))
  }

  /** Count of annotations waiting for human repair (stale anchors). */
  needsReview(document: PublicationDocument) {
    const meta = document.attrs?.publication as PublicationMetadataV1 | undefined
    const items = [...(meta?.claims ?? []), ...(meta?.results ?? [])]
    return items.filter((item) => item.state === 'needs_review').length
  }

  /** Chunks and assets that survived server hydration, i.e. the actor may use. */
  resolversFor(document: PublicationDocument): PublicationResolvers {
    const chunks = new Set<string>()
    const assets = new Set<string>()
    walk(document.content, (node) => {
      const chunk = node.attrs?.sourceChunkId
      const image = node.attrs?.documentImageId
      if (typeof chunk === 'string') {
        chunks.add(chunk)
        if (node.type === 'image') assets.add(chunk)
      }
      if (typeof image === 'string') assets.add(image)
    })
    return { chunks, assets }
  }

  /** Builds a TextRef for a substring of an existing block. */
  anchor(document: PublicationDocument, nodeId: string, from: number, to: number): TextRef {
    const node = indexNodes(document).nodes.get(nodeId)
    if (!node)
      throw publicationError([{ field: 'nodeId', message: 'This block no longer exists.' }])
    return { nodeId, from, to, textHash: textHash(flattenText(node).slice(from, to)) }
  }

  /**
   * Allocates missing block IDs from the seed and structural path, so replaying
   * the same save yields the same IDs. Existing IDs are never touched.
   */
  assignIds(document: PublicationDocument, seed: string): PublicationDocument {
    const next = clone(document)
    walk(next.content, (node, path) => {
      if (!IDENTIFIED_BLOCKS.has(node.type) || typeof node.attrs?.nodeId === 'string') return
      node.attrs = { ...node.attrs, nodeId: deterministicId(`${seed}:${path}`) }
    })
    return next
  }

  /**
   * For content rebuilt wholesale (a canvas projected to blocks, a generated canvas): block ids
   * are new, so the hero would point at blocks that no longer exist and every save would fail.
   * Gives the blocks ids, then rebinds a dangling hero title to the preferred block (else the first
   * heading, else the first non-empty block) and a dangling summary to the preferred block (else the
   * next non-empty paragraph), or drops it.
   * Other anchors are left to `reconcile`. With no text block to hold a title, the publication
   * metadata cannot be satisfied and is removed.
   */
  rebindHero(
    document: PublicationDocument,
    seed: string,
    /** Top-level block indexes to prefer (a canvas' title and summary frames); -1 for none. */
    prefer: { title?: number; summary?: number } = {}
  ): PublicationDocument {
    const meta = document.attrs?.publication as PublicationMetadataV1 | undefined
    if (!meta || typeof meta !== 'object' || !meta.hero) return document
    const next = this.assignIds(document, seed)
    const hero = (next.attrs!.publication as PublicationMetadataV1).hero
    const blocks: PublicationNode[] = []
    walk(next.content, (node) => {
      if (
        TEXT_BLOCKS.has(node.type) &&
        node.type !== 'codeBlock' &&
        typeof node.attrs?.nodeId === 'string' &&
        flattenText(node).trim()
      )
        blocks.push(node)
    })
    const exists = (id: unknown) => blocks.some((node) => node.attrs?.nodeId === id)
    const preferred = (index?: number) => {
      const node = index === undefined || index < 0 ? undefined : next.content[index]
      return node && blocks.includes(node) ? node : undefined
    }
    if (!exists(hero.title?.nodeId)) {
      const title =
        preferred(prefer.title) ?? blocks.find((node) => node.type === 'heading') ?? blocks[0]
      if (!title) {
        const attrs = { ...next.attrs }
        delete attrs.publication
        return { ...next, attrs } as PublicationDocument
      }
      hero.title = { nodeId: title.attrs!.nodeId as string }
    }
    if (hero.summary && !exists(hero.summary.nodeId)) {
      const after = blocks.findIndex((node) => node.attrs?.nodeId === hero.title.nodeId)
      const candidate = preferred(prefer.summary)
      const summary =
        candidate && candidate.attrs?.nodeId !== hero.title.nodeId
          ? candidate
          : blocks.slice(after + 1).find((node) => node.type === 'paragraph')
      if (summary) hero.summary = { nodeId: summary.attrs!.nodeId as string }
      else delete hero.summary
    }
    return next
  }

  /**
   * Safe reconciliation of an ordinary editor transaction: stale anchors become
   * `needs_review` and dangling section refs are pruned. Nothing is rebound to
   * different words and no prose is removed.
   */
  reconcile(document: PublicationDocument) {
    const diagnostics: PublicationDiagnostic[] = []
    const publication = document.attrs?.publication as PublicationMetadataV1 | undefined
    if (!publication || typeof publication !== 'object') return { document, diagnostics }
    const next = clone(document)
    const meta = next.attrs!.publication as PublicationMetadataV1
    const { nodes } = indexNodes(next)

    if (Array.isArray(meta.sections))
      for (const section of meta.sections) {
        if (section.heading && !nodes.has(section.heading.nodeId)) delete section.heading
        if (Array.isArray(section.nodeIds))
          section.nodeIds = section.nodeIds.filter((id) => typeof id !== 'string' || nodes.has(id))
      }

    // A reference no body node cites and no claim relies on is dropped, so
    // deleting the last citation does not block an ordinary save.
    if (Array.isArray(meta.references)) {
      const cited = new Set<string>()
      walk(next.content, (node) => {
        if (typeof node.attrs?.sourceChunkId === 'string') cited.add(node.attrs.sourceChunkId)
      })
      const relied = new Set(
        (meta.claims ?? []).flatMap((claim) =>
          claim?.state === 'active' ? claim.evidenceRefIds : []
        )
      )
      meta.references = meta.references.filter(
        (ref) => cited.has(ref.chunkId) || relied.has(ref.id)
      )
      if (!meta.references.length) delete meta.references
    }

    const stale = new Set<string>()
    if (Array.isArray(meta.claims))
      meta.claims = meta.claims.map((claim) => {
        if (claim?.state !== 'active') return claim
        const state = anchorState(nodes, claim.text)
        if (state === 'ok') return claim
        stale.add(claim.id)
        diagnostics.push({ code: state, id: claim.id })
        return { id: claim.id, state: 'needs_review', reason: state, nodeId: claim.text.nodeId }
      })
    if (Array.isArray(meta.results))
      meta.results = meta.results.map((result) => {
        if (result?.state !== 'active') return result
        const state = stale.has(result.claimId) ? 'text_changed' : anchorState(nodes, result.value)
        if (state === 'ok') return result
        diagnostics.push({ code: state, id: result.id })
        return {
          id: result.id,
          state: 'needs_review',
          reason: state,
          claimId: result.claimId,
          nodeId: result.value.nodeId,
        }
      })
    return { document: next, diagnostics }
  }

  /** Domain validation of structure, reference integrity and resources. */
  validate(document: PublicationDocument, resolvers: PublicationResolvers = {}): FieldError[] {
    if (document.attrs?.publication === undefined) return []
    const parsed = publicationSchema.safeParse(document.attrs.publication)
    if (!parsed.success) return toFieldErrors(parsed.error)

    const meta = parsed.data
    const errors: FieldError[] = []
    const fail = (path: string, message: string) =>
      errors.push({ field: `${PUBLICATION_FIELD_PREFIX}.${path}`, message })
    if (!(ENABLED_DOC_TYPES as readonly string[]).includes(meta.docType))
      fail('docType', 'This document type is not available yet.')

    const { nodes, duplicates } = indexNodes(document)
    if (duplicates.length)
      errors.push({ field: 'content.attrs.nodeId', message: 'Two blocks share one identity.' })

    const textblock = (path: string, nodeId: string) => {
      const node = nodes.get(nodeId)
      if (!node || !TEXT_BLOCKS.has(node.type) || node.type === 'codeBlock')
        fail(`${path}.nodeId`, 'Link this to an existing paragraph or heading.')
    }
    textblock('hero.title', meta.hero.title.nodeId)
    if (meta.hero.summary) textblock('hero.summary', meta.hero.summary.nodeId)

    const unique = (path: string, list: { id: string }[] | undefined) => {
      const seen = new Set<string>()
      list?.forEach((item, index) => {
        if (seen.has(item.id)) fail(`${path}.${index}.id`, 'This ID is used more than once.')
        seen.add(item.id)
      })
    }
    for (const key of [
      'sections',
      'claims',
      'results',
      'figures',
      'reviewerNotes',
      'references',
    ] as const)
      unique(key, meta[key])

    meta.sections.forEach((section, i) => {
      if (section.heading && !nodes.has(section.heading.nodeId))
        fail(`sections.${i}.heading.nodeId`, 'This block no longer exists.')
      section.nodeIds.forEach((id, j) => {
        if (!nodes.has(id)) fail(`sections.${i}.nodeIds.${j}`, 'This block no longer exists.')
      })
    })

    const references = new Set(meta.references?.map((item) => item.id))
    const activeClaims = new Set<string>()
    meta.claims?.forEach((claim, i) => {
      if (claim.state !== 'active') return
      activeClaims.add(claim.id)
      if (anchorState(nodes, claim.text) !== 'ok')
        fail(`claims.${i}.text`, 'This text no longer matches the saved wording.')
      claim.evidenceRefIds.forEach((ref, j) => {
        if (!references.has(ref))
          fail(`claims.${i}.evidenceRefIds.${j}`, 'Unknown evidence reference.')
      })
    })
    meta.results?.forEach((result, i) => {
      if (result.state !== 'active') return
      if (!activeClaims.has(result.claimId))
        fail(`results.${i}.claimId`, 'Link this result to an existing claim.')
      if (anchorState(nodes, result.value) !== 'ok')
        fail(`results.${i}.value`, 'This text no longer matches the saved wording.')
    })
    meta.figures?.forEach((figure, i) => {
      const image = nodes.get(figure.image.nodeId)
      const attr = figure.asset.kind === 'source_chunk' ? 'sourceChunkId' : 'documentImageId'
      if (image?.type !== 'image' || image.attrs?.[attr] !== figure.asset.id)
        fail(`figures.${i}.asset`, 'This figure does not match a registered image.')
      else if (resolvers.assets && !resolvers.assets.has(figure.asset.id))
        fail(`figures.${i}.asset`, 'This image is not available.')
      if (figure.caption && !nodes.has(figure.caption.nodeId))
        fail(`figures.${i}.caption.nodeId`, 'This block no longer exists.')
    })
    meta.reviewerNotes?.forEach((note, i) => {
      if (note.nodeId && !nodes.has(note.nodeId))
        fail(`reviewerNotes.${i}.nodeId`, 'This block no longer exists.')
    })
    meta.references?.forEach((ref, i) => {
      if (resolvers.chunks && !resolvers.chunks.has(ref.chunkId))
        fail(`references.${i}.chunkId`, 'This source is not available.')
    })
    return errors.slice(0, 20)
  }

  /**
   * Save-boundary entry: assign IDs, reconcile editor edits, then validate the
   * whole candidate. Documents without publication metadata pass unchanged.
   */
  accept(
    document: PublicationDocument,
    options: { seed?: string; resolvers?: PublicationResolvers } = {}
  ): PublicationDocument {
    if (document.attrs?.publication === undefined) return document
    const identified = options.seed ? this.assignIds(document, options.seed) : document
    const { document: reconciled } = this.reconcile(identified)
    const errors = this.validate(reconciled, options.resolvers)
    if (errors.length) throw publicationError(errors)
    return reconciled
  }

  /**
   * Internal semantic projection of an accepted document. The TipTap tree is
   * never changed; layout consumers read resolved text and assets from here.
   */
  derive(
    document: PublicationDocument,
    sourceVersionId: string,
    resolvers: PublicationResolvers = {}
  ) {
    const meta = document.attrs?.publication as PublicationMetadataV1 | undefined
    if (!meta)
      throw publicationError([
        { field: PUBLICATION_FIELD_PREFIX, message: 'This document has no publication metadata.' },
      ])
    const { document: current, diagnostics } = this.reconcile(document)
    const errors = this.validate(current, resolvers)
    if (errors.length) throw publicationError(errors)
    const accepted = current.attrs!.publication as PublicationMetadataV1
    const { nodes } = indexNodes(current)
    const text = (nodeId: string) => flattenText(nodes.get(nodeId)!)
    const slice = (ref: TextRef) => text(ref.nodeId).slice(ref.from, ref.to)

    const references = accepted.references ?? []
    const refTuple = new Map(references.map((ref) => [ref.id, ref.chunkId]))
    const claims = (accepted.claims ?? []).flatMap((claim) => {
      if (claim.state !== 'active') return []
      const evidence = claim.evidenceRefIds.map((id) => refTuple.get(id)!).sort()
      return [
        {
          id: claim.id,
          text: slice(claim.text),
          authorship: claim.authorship,
          evidenceRefIds: claim.evidenceRefIds,
          claimHash: sha256(stable({ text: claim.text.textHash, evidence })),
        },
      ]
    })
    const results = (accepted.results ?? []).flatMap((result) => {
      if (result.state !== 'active') return []
      const claim = claims.find((item) => item.id === result.claimId)
      if (result.qualifier === 'measured') {
        if (!claim?.evidenceRefIds.length)
          diagnostics.push({ code: 'measured_without_evidence', id: result.id })
        if (!result.baseline && !result.period && !result.scope)
          diagnostics.push({ code: 'measured_without_context', id: result.id })
      }
      const { state, value, ...rest } = result
      return state === 'active' ? [{ ...rest, value: slice(value) }] : []
    })
    for (const item of [...(accepted.claims ?? []), ...(accepted.results ?? [])])
      if (item.state === 'needs_review')
        diagnostics.push({ code: item.reason, id: item.id, nodeId: item.nodeId })

    return {
      identity: {
        sourceVersionId,
        contentHash: this.contentHash(current),
      } satisfies PublicationIdentity,
      docType: accepted.docType,
      ...(accepted.format ? { format: accepted.format } : {}),
      hero: {
        title: { nodeId: accepted.hero.title.nodeId, text: text(accepted.hero.title.nodeId) },
        ...(accepted.hero.summary
          ? {
              summary: {
                nodeId: accepted.hero.summary.nodeId,
                text: text(accepted.hero.summary.nodeId),
              },
            }
          : {}),
      },
      sections: accepted.sections.map((section) => ({
        id: section.id,
        type: section.type,
        ...(section.heading
          ? { heading: { nodeId: section.heading.nodeId, text: text(section.heading.nodeId) } }
          : {}),
        blocks: section.nodeIds.map((id) => nodes.get(id)!),
      })),
      claims,
      results,
      figures: (accepted.figures ?? []).map((figure) => ({
        id: figure.id,
        asset: figure.asset,
        image: nodes.get(figure.image.nodeId)!,
        ...(figure.caption ? { caption: text(figure.caption.nodeId) } : {}),
      })),
      references,
      reviewerNotes: accepted.reviewerNotes ?? [],
      diagnostics,
    }
  }

  /**
   * Typed reverse edits against the exact accepted base. Returns TipTap JSON
   * for the ordinary save boundary; never accepts a render DTO as content.
   */
  applyEdits(
    base: PublicationDocument,
    identity: PublicationIdentity,
    patches: PublicationPatch[]
  ): PublicationDocument {
    if (!identity?.sourceVersionId || identity.contentHash !== this.contentHash(base))
      throw new Exception('The saved document changed. Reload before editing again.', {
        status: 409,
        code: 'E_STALE_PUBLICATION',
      })
    if (!patches.length) return base
    const next = clone(base)
    const meta = next.attrs?.publication as PublicationMetadataV1 | undefined
    if (!meta)
      throw publicationError([
        { field: PUBLICATION_FIELD_PREFIX, message: 'This document has no publication metadata.' },
      ])
    const { nodes } = indexNodes(next)
    const problems: FieldError[] = []

    patches.forEach((patch, index) => {
      const field = `patches.${index}`
      if (patch.type === 'replaceText') {
        const ref = patch.target === 'hero.title' ? meta.hero.title : meta.hero.summary
        const node = ref && nodes.get(ref.nodeId)
        if (!node || !patch.text.trim()) {
          problems.push({ field: `${field}.text`, message: 'Enter text for a block that exists.' })
          return
        }
        // Citations stay; only text runs and hard breaks are replaced.
        node.content = [
          { type: 'text', text: patch.text },
          ...(node.content ?? []).filter((child) => child.type === 'sourceCitation'),
        ]
      } else if (patch.type === 'setResultContext') {
        const result = meta.results?.find((item) => item.id === patch.resultId)
        if (result?.state !== 'active') {
          problems.push({ field: `${field}.resultId`, message: 'Choose an existing result.' })
          return
        }
        const target = result as Record<string, unknown>
        for (const [key, value] of Object.entries(patch)) {
          if (key === 'type' || key === 'resultId') continue
          if (value === null) delete target[key]
          else if (value !== undefined) target[key] = value
        }
      } else if (patch.type === 'upsertNote') {
        const notes = (meta.reviewerNotes ??= [])
        const id =
          patch.id ?? deterministicId(`${identity.contentHash}:note:${index}:${patch.message}`)
        const note = {
          id,
          ...(patch.nodeId ? { nodeId: patch.nodeId } : {}),
          message: patch.message,
        }
        const at = notes.findIndex((item) => item.id === id)
        if (at >= 0) notes[at] = note
        else notes.push(note)
      } else {
        meta.reviewerNotes = meta.reviewerNotes?.filter((item) => item.id !== patch.id)
        if (!meta.reviewerNotes?.length) delete meta.reviewerNotes
      }
    })
    if (problems.length) throw publicationError(problems)
    return this.accept(next)
  }

  /**
   * Deterministic legacy → v1 mapping. Only adds block IDs and root metadata;
   * text, order, marks, images and citations are untouched. Meaning that prose
   * does not establish (authorship, qualifiers, public rights) is reported,
   * never invented.
   */
  mapLegacy(document: PublicationDocument, namespace: string) {
    const unresolved: PublicationDiagnostic[] = []
    if (document.attrs?.publication !== undefined)
      return {
        document,
        report: {
          mapped: false,
          identitiesAssigned: 0,
          preservedNodes: 0,
          unresolved: [{ code: 'already_mapped' }],
        } as LegacyMappingReport,
      }
    let count = 0
    walk(document.content, () => count++)
    const identified = this.assignIds(document, namespace)
    let assigned = 0
    walk(identified.content, (node) => {
      if (IDENTIFIED_BLOCKS.has(node.type)) assigned++
    })
    const top = identified.content
    const idOf = (node: PublicationNode) => node.attrs!.nodeId as string
    const titleAt = top.findIndex((node) => node.type === 'heading' && node.attrs?.level === 1)
    if (titleAt < 0) {
      unresolved.push({ code: 'missing_title' })
      return {
        document,
        report: {
          mapped: false,
          identitiesAssigned: 0,
          preservedNodes: count,
          unresolved,
        } as LegacyMappingReport,
      }
    }
    const summaryNode = top[titleAt + 1]?.type === 'paragraph' ? top[titleAt + 1] : undefined
    const bodyStart = titleAt + (summaryNode ? 2 : 1)

    const sections: PublicationMetadataV1['sections'] = []
    const pre = top.slice(0, titleAt)
    let current: PublicationMetadataV1['sections'][number] | null = null
    const open = (heading?: PublicationNode) => {
      current = {
        id: deterministicId(`${namespace}:section:${heading ? idOf(heading) : sections.length}`),
        type: 'narrative',
        ...(heading ? { heading: { nodeId: idOf(heading) } } : {}),
        nodeIds: [],
      }
      sections.push(current)
    }
    for (const node of [...pre, ...top.slice(bodyStart)]) {
      if (node.type === 'heading') open(node)
      else {
        if (!current) open()
        current!.nodeIds.push(idOf(node))
      }
    }
    // Drop an empty preamble section created only by a leading heading boundary.
    const mappedSections = sections.filter((section) => section.heading || section.nodeIds.length)

    const figures: NonNullable<PublicationMetadataV1['figures']> = []
    const references = new Map<string, string>()
    walk(identified.content, (node) => {
      if (node.type === 'image') {
        const chunk = node.attrs?.sourceChunkId
        const image = node.attrs?.documentImageId
        const asset =
          typeof image === 'string'
            ? { kind: 'document_image' as const, id: image }
            : typeof chunk === 'string'
              ? { kind: 'source_chunk' as const, id: chunk }
              : null
        if (asset)
          figures.push({
            id: deterministicId(`${namespace}:figure:${idOf(node)}`),
            image: { nodeId: idOf(node) },
            asset,
          })
        else unresolved.push({ code: 'image_without_registered_asset', nodeId: idOf(node) })
      } else if (node.type === 'sourceCitation' && typeof node.attrs?.sourceChunkId === 'string') {
        const chunkId = node.attrs.sourceChunkId
        if (!references.has(chunkId))
          references.set(chunkId, deterministicId(`${namespace}:ref:${chunkId}`))
      } else if (
        TEXT_BLOCKS.has(node.type) &&
        /\b(TODO|FIXME|INTERNAL|REVIEWER)\b/.test(flattenText(node))
      )
        unresolved.push({ code: 'possible_internal_comment', nodeId: idOf(node) })
    })
    unresolved.push({ code: 'authorship_unknown' }, { code: 'results_not_annotated' })

    const publication: PublicationMetadataV1 = {
      schemaVersion: PUBLICATION_SCHEMA_VERSION,
      docType: 'case_study',
      hero: {
        title: { nodeId: idOf(top[titleAt]) },
        ...(summaryNode ? { summary: { nodeId: idOf(summaryNode) } } : {}),
      },
      sections: mappedSections,
      ...(figures.length ? { figures } : {}),
      ...(references.size
        ? { references: [...references].map(([chunkId, id]) => ({ id, chunkId })) }
        : {}),
    }
    const mapped = { ...identified, attrs: { ...identified.attrs, publication } }
    const errors = this.validate(mapped)
    if (errors.length) throw publicationError(errors)
    return {
      document: mapped,
      report: {
        mapped: true,
        identitiesAssigned: assigned,
        preservedNodes: count,
        unresolved,
      } as LegacyMappingReport,
    }
  }
}
