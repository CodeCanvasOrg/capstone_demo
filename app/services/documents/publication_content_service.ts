import { createHash } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import {
  ENABLED_DOC_TYPES,
  PUBLICATION_SCHEMA_VERSION,
  QUALIFIERS,
  flattenText,
  publicationMetadataSchema,
  zodFieldErrors,
  type FieldError,
  type PublicationMetadata,
  type TextRef,
  type ReviewReason,
  type Qualifier,
} from '../../../shared/publication/content.ts'

type Node = TipTapDocument['content'][number]
type Doc = TipTapDocument & { attrs?: Record<string, unknown> }
type Claim = NonNullable<PublicationMetadata['claims']>[number]
type Result = NonNullable<PublicationMetadata['results']>[number]

const MAX_ERRORS = 50
const BLOCKS = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'image',
  'horizontalRule',
])
const TEXTBLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])

export class PublicationContentError extends Exception {
  readonly messages: FieldError[]
  constructor(errors: FieldError[]) {
    super('Check the highlighted content fields.', { status: 422, code: 'E_PUBLICATION_CONTENT' })
    this.messages = errors.slice(0, MAX_ERRORS)
  }
}

export type PublicationIdentity = { versionId: string; contentHash: string }
export type PublicationDiagnostic = {
  code: string
  field: string
  severity: 'warning' | 'error'
  message: string
}
export type PublicationPatch =
  | { op: 'replace_text'; target: 'hero.title' | 'hero.summary'; text: string }
  | {
      op: 'set_result'
      resultId: string
      qualifier?: string
      comparison?: 'exact' | 'up_to' | 'at_least' | 'range'
      units?: string
      scope?: string
      baseline?: string
      period?: string
      methodology?: string
    }
  | { op: 'put_note'; id?: string; message: string; nodeId?: string }
  | { op: 'remove_note'; id: string }

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Stable key order so a hash does not depend on how a client serialized the tree. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`
  return JSON.stringify(value)
}

/** Deterministic UUID (v5 layout) so a replay allocates the same identities. */
export function stableId(namespace: string, key: string) {
  const bytes = createHash('sha256').update(`${namespace}\0${key}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const clone = <T>(value: T): T => structuredClone(value)

type Located = { node: Node; path: string }

function index(document: Doc) {
  const byId = new Map<string, Located>()
  const duplicates: string[] = []
  const walk = (nodes: Node[] = [], path: string) =>
    nodes.forEach((node, i) => {
      const here = `${path}.${i}`
      const nodeId = node.attrs?.nodeId
      if (typeof nodeId === 'string') {
        if (byId.has(nodeId)) duplicates.push(`${here}.attrs.nodeId`)
        else byId.set(nodeId, { node, path: here })
      }
      walk(node.content, `${here}.content`)
    })
  walk(document.content, 'content.content')
  return { byId, duplicates }
}

const rangeText = (node: Node, ref: TextRef) => {
  const text = flattenText(node)
  return ref.to <= text.length ? text.slice(ref.from, ref.to) : null
}

export function textRef(node: Node, from: number, to: number): TextRef {
  return {
    nodeId: node.attrs!.nodeId as string,
    from,
    to,
    textHash: sha256(flattenText(node).slice(from, to)),
  }
}

/**
 * Authoritative structural validation of an annotated document. Returns field
 * errors; `reconcile` is the separate, explicit path for ordinary edits.
 */
export default class PublicationContentService {
  validate(document: Doc): FieldError[] {
    const raw = document.attrs?.publication
    if (raw === undefined) return []
    const parsed = publicationMetadataSchema.safeParse(raw)
    if (!parsed.success) return zodFieldErrors(parsed.error).slice(0, MAX_ERRORS)
    const meta = parsed.data
    const errors: FieldError[] = []
    const at = (path: string, message: string) =>
      void errors.push({ field: `content.attrs.publication.${path}`, message })

    if (!ENABLED_DOC_TYPES.includes(meta.docType))
      at('docType', `Document type ${meta.docType} is not available yet.`)

    const { byId, duplicates } = index(document)
    for (const field of duplicates)
      errors.push({ field, message: 'Block identity must be unique.' })

    const node = (nodeId: string, path: string, types?: string[]) => {
      const found = byId.get(nodeId)
      if (!found) return (at(path, 'This block no longer exists.'), null)
      if (types && !types.includes(found.node.type))
        return (at(path, `Expected ${types.join(' or ')}.`), null)
      return found.node
    }
    const unique = (items: { id: string }[] | undefined, name: string) => {
      const seen = new Set<string>()
      items?.forEach((item, i) => {
        if (seen.has(item.id)) at(`${name}.${i}.id`, 'Identifier must be unique.')
        seen.add(item.id)
      })
    }
    for (const name of [
      'sections',
      'claims',
      'results',
      'figures',
      'reviewerNotes',
      'references',
    ] as const)
      unique(meta[name], name)

    node(meta.hero.title.nodeId, 'hero.title.nodeId', ['heading'])
    if (meta.hero.summary) node(meta.hero.summary.nodeId, 'hero.summary.nodeId', ['paragraph'])
    meta.sections.forEach((section, i) => {
      if (section.heading) node(section.heading.nodeId, `sections.${i}.heading.nodeId`, ['heading'])
      section.nodeIds.forEach((nodeId, n) => node(nodeId, `sections.${i}.nodeIds.${n}`))
    })

    const refIds = new Set((meta.references ?? []).map((r) => r.id))
    const anchor = (ref: TextRef, path: string, state: string) => {
      // Unresolved records keep their last-known anchor for repair, even if its block is gone.
      if (state !== 'active') return
      const target = node(ref.nodeId, `${path}.nodeId`, [...TEXTBLOCKS])
      if (!target) return
      const text = rangeText(target, ref)
      if (text === null) return at(`${path}.to`, 'Range is outside the block text.')
      if (sha256(text) !== ref.textHash)
        at(`${path}.textHash`, 'The text changed since this was annotated.')
    }
    const claimIds = new Set((meta.claims ?? []).map((c) => c.id))
    meta.claims?.forEach((c, i) => {
      anchor(c.text, `claims.${i}.text`, c.state)
      c.evidenceRefIds.forEach((r, n) => {
        if (!refIds.has(r)) at(`claims.${i}.evidenceRefIds.${n}`, 'Unknown evidence reference.')
      })
    })
    meta.results?.forEach((r, i) => {
      anchor(r.value, `results.${i}.value`, r.state)
      if (!claimIds.has(r.claimId)) at(`results.${i}.claimId`, 'Unknown claim.')
    })
    meta.figures?.forEach((f, i) => {
      const image = node(f.image.nodeId, `figures.${i}.image.nodeId`, ['image'])
      if (f.caption) node(f.caption.nodeId, `figures.${i}.caption.nodeId`, ['paragraph'])
      const key = f.asset.kind === 'document_image' ? 'documentImageId' : 'sourceChunkId'
      if (image && image.attrs?.[key] !== f.asset.id)
        at(`figures.${i}.asset.id`, 'Asset does not match the image block.')
    })
    meta.reviewerNotes?.forEach((n, i) => {
      if (n.nodeId) node(n.nodeId, `reviewerNotes.${i}.nodeId`)
    })
    return errors.slice(0, MAX_ERRORS)
  }

  assertValid(document: Doc) {
    const errors = this.validate(document)
    if (errors.length) throw new PublicationContentError(errors)
  }

  /**
   * Ordinary-edit reconciliation. Annotations whose words changed or vanished
   * become `needs_review` (never rebound to other words and never deleted);
   * pointers to removed blocks are pruned from sections and notes. Prose is
   * untouched.
   */
  reconcile(document: Doc): Doc {
    const raw = document.attrs?.publication
    const parsed = publicationMetadataSchema.safeParse(raw)
    if (!parsed.success) return document
    const meta = clone(parsed.data)
    const { byId } = index(document)

    const reason = (ref: TextRef): ReviewReason | null => {
      const target = byId.get(ref.nodeId)?.node
      if (!target || !TEXTBLOCKS.has(target.type)) return 'node_removed'
      const text = rangeText(target, ref)
      if (text === null) return 'range_out_of_bounds'
      return sha256(text) === ref.textHash ? null : 'text_changed'
    }
    if (meta.claims)
      meta.claims = meta.claims.map((c): Claim => {
        const why = c.state === 'active' ? reason(c.text) : null
        return why ? { ...c, state: 'needs_review', reason: why } : c
      })
    const stale = new Set((meta.claims ?? []).filter((c) => c.state !== 'active').map((c) => c.id))
    if (meta.results)
      meta.results = meta.results.map((r): Result => {
        if (r.state !== 'active') return r
        const why = reason(r.value) ?? (stale.has(r.claimId) ? 'claim_needs_review' : null)
        return why ? { ...r, state: 'needs_review', reason: why } : r
      })
    for (const section of meta.sections) {
      section.nodeIds = section.nodeIds.filter((id) => byId.has(id))
      if (section.heading && !byId.has(section.heading.nodeId)) delete section.heading
    }
    if (meta.reviewerNotes)
      meta.reviewerNotes = meta.reviewerNotes.map((n) =>
        n.nodeId && !byId.has(n.nodeId) ? { id: n.id, message: n.message } : n
      )
    return { ...document, attrs: { ...document.attrs, publication: meta } }
  }

  /**
   * Internal semantic projection of a validated, accepted document. The tree is
   * not modified. Unresolved annotations are excluded from structured rows and
   * reported instead; absent optional context stays absent.
   */
  derive(document: Doc, versionId: string) {
    this.assertValid(document)
    const meta = publicationMetadataSchema.parse(document.attrs?.publication)
    const { byId } = index(document)
    const text = (nodeId: string) => flattenText(byId.get(nodeId)!.node)
    const diagnostics: PublicationDiagnostic[] = []
    const claims = new Map((meta.claims ?? []).map((c) => [c.id, c]))

    const results = (meta.results ?? []).flatMap((r, i) => {
      if (r.state !== 'active') {
        diagnostics.push({
          code: 'needs_review',
          field: `results.${i}`,
          severity: 'warning',
          message: `Result needs review (${r.reason}).`,
        })
        return []
      }
      const claim = claims.get(r.claimId)
      const missing = (['units', 'baseline', 'period'] as const).filter((k) => !r[k])
      if (missing.length)
        diagnostics.push({
          code: 'result_context_missing',
          field: `results.${i}`,
          severity: 'warning',
          message: `Missing context: ${missing.join(', ')}.`,
        })
      if (r.qualifier === 'measured' && !claim?.evidenceRefIds.length)
        diagnostics.push({
          code: 'result_missing_evidence',
          field: `results.${i}`,
          severity: 'warning',
          message: 'A measured result has no evidence reference.',
        })
      const { id, claimId, value, qualifier, ...rest } = r
      delete (rest as { state?: string }).state
      return [
        {
          id,
          claimId,
          qualifier,
          // The original phrase, never a re-parsed number.
          value: byId.get(value.nodeId) ? text(value.nodeId).slice(value.from, value.to) : '',
          ...rest,
        },
      ]
    })
    meta.claims?.forEach((c, i) => {
      if (c.state !== 'active')
        diagnostics.push({
          code: 'needs_review',
          field: `claims.${i}`,
          severity: 'warning',
          message: `Claim needs review (${c.reason}).`,
        })
    })

    return {
      identity: {
        versionId,
        contentHash: sha256(canonicalJson(document)),
      } satisfies PublicationIdentity,
      docType: meta.docType,
      hero: {
        title: text(meta.hero.title.nodeId),
        ...(meta.hero.summary ? { summary: text(meta.hero.summary.nodeId) } : {}),
      },
      sections: meta.sections.map((s) => ({
        id: s.id,
        type: s.type,
        ...(s.heading ? { heading: text(s.heading.nodeId) } : {}),
        blocks: s.nodeIds.map((nodeId) => byId.get(nodeId)!.node),
      })),
      results,
      figures: (meta.figures ?? []).map((f) => ({
        id: f.id,
        asset: f.asset,
        image: byId.get(f.image.nodeId)!.node,
        ...(f.caption ? { caption: text(f.caption.nodeId) } : {}),
      })),
      // Private: never reaches the client projection.
      reviewerNotes: meta.reviewerNotes ?? [],
      references: meta.references ?? [],
      diagnostics,
    }
  }

  /**
   * Maps a legacy, unannotated document to publication v1 without a second
   * authority: the TipTap tree gains identities and metadata but its text,
   * order, marks, images and citations are unchanged. Nothing is inferred
   * about measurement, authorship or support.
   */
  mapLegacy(document: Doc, namespace: string) {
    const report = { unresolved: [] as { code: string; nodeId?: string }[], assigned: 0 }
    const next = clone(document)
    const assign = (nodes: Node[] = [], path: string) =>
      nodes.forEach((node, i) => {
        const here = `${path}.${i}`
        if (BLOCKS.has(node.type) && typeof node.attrs?.nodeId !== 'string') {
          node.attrs = { ...node.attrs, nodeId: stableId(namespace, `node:${here}`) }
          report.assigned++
        }
        assign(node.content, `${here}.c`)
      })
    assign(next.content, 'doc')

    const top = next.content
    const idOf = (node: Node) => node.attrs!.nodeId as string
    if (top[0]?.type !== 'heading' || top[0].attrs?.level !== 1) {
      // Stays editable on the legacy path; no title is fabricated.
      report.unresolved.push({ code: 'missing_hero_title' })
      return { document: document, report, mapped: false as const }
    }

    const hasSummary = top[1]?.type === 'paragraph'
    const sections: PublicationMetadata['sections'] = []
    let current: PublicationMetadata['sections'][number] | null = null
    top.slice(hasSummary ? 2 : 1).forEach((node) => {
      if (node.type === 'heading' && node.attrs?.level === 2) {
        current = {
          id: stableId(namespace, `section:${idOf(node)}`),
          type: 'narrative',
          heading: { nodeId: idOf(node) },
          nodeIds: [],
        }
        sections.push(current)
      } else {
        if (!current) {
          current = { id: stableId(namespace, 'section:preamble'), type: 'narrative', nodeIds: [] }
          sections.push(current)
        }
        current.nodeIds.push(idOf(node))
      }
    })

    const references = new Map<string, { id: string; chunkId: string }>()
    const figures: NonNullable<PublicationMetadata['figures']> = []
    const visit = (node: Node) => {
      const chunk = node.attrs?.sourceChunkId
      if (node.type === 'sourceCitation' && typeof chunk === 'string' && !references.has(chunk))
        references.set(chunk, { id: stableId(namespace, `ref:${chunk}`), chunkId: chunk })
      if (node.type === 'image') {
        const documentImageId = node.attrs?.documentImageId
        const asset =
          typeof documentImageId === 'string'
            ? { kind: 'document_image' as const, id: documentImageId }
            : typeof chunk === 'string'
              ? { kind: 'source_chunk' as const, id: chunk }
              : null
        if (asset)
          figures.push({
            id: stableId(namespace, `figure:${idOf(node)}`),
            image: { nodeId: idOf(node) },
            asset,
          })
        else report.unresolved.push({ code: 'image_without_registered_asset', nodeId: idOf(node) })
      }
      node.content?.forEach(visit)
    }
    top.forEach(visit)

    // Reported for a person; the prose itself is never edited or converted.
    const flagged = (node: Node) => {
      if (TEXTBLOCKS.has(node.type) && node.attrs?.nodeId) {
        const text = flattenText(node)
        if (/\b(?:up to|estimated|target|projected)\b/i.test(text))
          report.unresolved.push({ code: 'unstructured_qualifier', nodeId: idOf(node) })
        if (/\[\s*(?:reviewer|internal|todo|tbd|fixme)\b|\b(?:TODO|FIXME)\b/i.test(text))
          report.unresolved.push({ code: 'internal_comment', nodeId: idOf(node) })
      }
      node.content?.forEach(flagged)
    }
    top.forEach(flagged)

    const metadata: PublicationMetadata = {
      schemaVersion: PUBLICATION_SCHEMA_VERSION,
      docType: 'case_study',
      hero: {
        title: { nodeId: idOf(top[0]) },
        ...(hasSummary ? { summary: { nodeId: idOf(top[1]) } } : {}),
      },
      sections,
      ...(figures.length ? { figures } : {}),
      ...(references.size ? { references: [...references.values()] } : {}),
    }
    next.attrs = { ...next.attrs, publication: metadata }
    this.assertValid(next)
    return { document: next, report, mapped: true as const }
  }

  /**
   * Typed reverse edits against an accepted base. Returns TipTap JSON for the
   * normal save boundary; a render DTO is never accepted as the new document.
   */
  applyEdits(
    base: { document: Doc; versionId: string },
    identity: PublicationIdentity,
    patches: PublicationPatch[]
  ): Doc {
    if (
      identity?.versionId !== base.versionId ||
      identity.contentHash !== sha256(canonicalJson(base.document))
    )
      throw new Exception('The document changed. Reload it and try again.', {
        status: 409,
        code: 'E_STALE_PUBLICATION',
      })
    this.assertValid(base.document)
    let doc = clone(base.document)
    const meta = () => doc.attrs!.publication as PublicationMetadata
    const errors: FieldError[] = []

    patches.forEach((patch, i) => {
      const field = `patches.${i}`
      if (patch.op === 'replace_text') {
        const nodeId =
          patch.target === 'hero.title' ? meta().hero.title.nodeId : meta().hero.summary?.nodeId
        const target = nodeId ? index(doc).byId.get(nodeId)?.node : undefined
        if (!target)
          return void errors.push({ field: `${field}.target`, message: 'No such field.' })
        if (typeof patch.text !== 'string' || !patch.text.trim() || patch.text.length > 2000)
          return void errors.push({
            field: `${field}.text`,
            message: 'Enter text up to 2000 characters.',
          })
        // Keep the first run's marks; the replaced words are the only change.
        const first = target.content?.find((n) => n.type === 'text')
        target.content = [
          { type: 'text', text: patch.text, ...(first?.marks ? { marks: first.marks } : {}) },
        ]
      } else if (patch.op === 'set_result') {
        const found = meta().results?.find((r) => r.id === patch.resultId)
        if (!found)
          return void errors.push({ field: `${field}.resultId`, message: 'Unknown result.' })
        if (found.state !== 'active')
          return void errors.push({
            field: `${field}.resultId`,
            message: 'Resolve this result first.',
          })
        const { qualifier, ...context } = patch
        delete (context as { op?: string }).op
        delete (context as { resultId?: string }).resultId
        if (qualifier !== undefined) {
          if (!(QUALIFIERS as readonly string[]).includes(qualifier))
            return void errors.push({
              field: `${field}.qualifier`,
              message: `Choose ${QUALIFIERS.join(', ')}.`,
            })
          found.qualifier = qualifier as Qualifier
        }
        Object.assign(found, context)
      } else if (patch.op === 'put_note') {
        const notes = (meta().reviewerNotes ??= [])
        const existing = patch.id ? notes.find((n) => n.id === patch.id) : undefined
        if (patch.id && !existing)
          return void errors.push({ field: `${field}.id`, message: 'Unknown note.' })
        const id = existing?.id ?? stableId(base.versionId, `note:${i}:${sha256(patch.message)}`)
        const entry = {
          id,
          ...(patch.nodeId ? { nodeId: patch.nodeId } : {}),
          message: patch.message,
        }
        if (existing) Object.assign(existing, entry)
        else notes.push(entry)
      } else if (patch.op === 'remove_note') {
        const before = meta().reviewerNotes?.length ?? 0
        meta().reviewerNotes = meta().reviewerNotes?.filter((n) => n.id !== patch.id)
        if ((meta().reviewerNotes?.length ?? 0) === before)
          errors.push({ field: `${field}.id`, message: 'Unknown note.' })
        if (!meta().reviewerNotes?.length) delete meta().reviewerNotes
      } else errors.push({ field, message: 'Unsupported edit.' })
    })
    if (errors.length) throw new PublicationContentError(errors)

    // Only the target and explicitly affected hashes change.
    doc = this.reconcile(doc)
    this.assertValid(doc)
    return doc
  }
}
