import { segments } from '../../../shared/templates/editor.ts'
import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import {
  canonicalSchema,
  blockText,
  wordCount,
  type CanonicalContent,
  type ValidationIssue,
} from '../../../shared/templates/content.ts'
import type { TemplateDefinition, TemplateSetup } from '../../../shared/templates/catalog.ts'
import { fingerprint } from '#services/workspaces/task_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
export type EvidenceReference = {
  id: string
  fileId: string
  revisionId: string
  runId: string
  blockId: string
  locator: Record<string, unknown>
  sourceHash: string
  evidenceHash: string
  content: string
  kind: string
}
export type Manifest = EvidenceReference[]
export type ClaimReview = { claim_hash: string; evidence_hash: string; decision: string }
export default class CanonicalContentService {
  parse(value: unknown): CanonicalContent {
    if (JSON.stringify(value)?.length > 1500000)
      throw new Exception('Content is too large', { status: 422 })
    const result = canonicalSchema.safeParse(value)
    if (!result.success)
      throw new Exception(
        'Invalid template content. Keep the required sections and supported block fields.',
        { status: 422, code: 'E_CANONICAL_CONTENT' }
      )
    for (const block of result.data.sections.flatMap((section) => section.blocks))
      if (block.type === 'paragraph')
        for (const mark of block.marks ?? []) {
          if (
            mark.from >= mark.to ||
            mark.to > block.text.length ||
            (mark.type === 'link' && !/^https?:\/\//.test(mark.href ?? '')) ||
            (mark.type !== 'link' && mark.href)
          )
            throw new Exception('Invalid inline formatting', { status: 422 })
        }
    const ids = result.data.sections.flatMap((s) => s.blocks.map((b) => b.id))
    if (
      new Set(ids).size !== ids.length ||
      new Set(result.data.sections.map((s) => s.key)).size !== result.data.sections.length
    )
      throw new Exception('Duplicate section or block identity', { status: 422 })
    return result.data
  }
  assignIds(content: CanonicalContent, previous?: CanonicalContent) {
    const known = new Set(previous?.sections.flatMap((s) => s.blocks.map((b) => b.id)) ?? [])
    return {
      ...content,
      sections: content.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => ({ ...b, id: known.has(b.id) ? b.id : randomUUID() })),
      })),
    }
  }
  claim(block: CanonicalContent['sections'][number]['blocks'][number], manifest: Manifest) {
    const refs = manifest.filter((e) => block.evidenceIds.includes(e.id))
    return {
      // Preserve semantic field boundaries; formatting-only changes keep the same claim.
      claimHash: fingerprint(
        Object.fromEntries(
          Object.entries(block).filter(([key]) => !['marks', 'evidenceIds'].includes(key))
        )
      ),
      evidenceHash: fingerprint(
        refs
          .map((e) => ({ id: e.id, hash: e.evidenceHash }))
          .sort((a, b) => a.id.localeCompare(b.id))
      ),
    }
  }
  validate(
    content: CanonicalContent,
    template: TemplateDefinition,
    setup: TemplateSetup,
    manifest: Manifest,
    reviews: ClaimReview[] = []
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const add = (
      code: string,
      message: string,
      severity: 'blocking' | 'warning' = 'blocking',
      anchor: Partial<ValidationIssue> = {}
    ) => issues.push({ code, message, severity, ...anchor })
    if (setup.audience === 'public' && !setup.brandVersionId)
      add('brand_required', 'Select reviewed company brand content before public approval.')
    if (content.language !== setup.language || content.stage !== setup.stage)
      add('identity_mismatch', 'Language and stage must match the saved setup.')
    const keys = content.sections.map((s) => s.key)
    const allowed = template.sections.map((s) => s.key)
    if (
      keys.some((k) => !allowed.includes(k)) ||
      keys.some((k, i) => i > 0 && allowed.indexOf(keys[i - 1]) >= allowed.indexOf(k))
    )
      add('section_order', 'Use the selected template sections in their defined order.')
    for (const definition of template.sections) {
      const section = content.sections.find((s) => s.key === definition.key)
      const required =
        definition.required ||
        (definition.key === 'limitations' && content.outcomeStatus === 'not_measured')
      if (required && (!section?.blocks.length || !section.blocks.some((b) => blockText(b).trim())))
        add('missing_section', `Complete ${definition.heading}.`, 'blocking', {
          sectionKey: definition.key,
        })
      if (section) {
        const n = wordCount(section.blocks.map(blockText).join(' '))
        if (n < definition.min || n > definition.max)
          add(
            'section_length',
            `${definition.heading}: aim for ${definition.min}–${definition.max} words (currently ${n}).`,
            'warning',
            { sectionKey: definition.key }
          )
      }
    }
    const words = wordCount(content.sections.flatMap((s) => s.blocks.map(blockText)).join(' '))
    if (words < template.words[0] || words > template.words[1])
      add(
        'document_length',
        `Use ${template.words[0]}–${template.words[1]} words excluding captions (currently ${words}).`
      )
    const allBlocks = content.sections.flatMap((s) => s.blocks)
    if (allBlocks.filter((b) => b.type === 'image').length > 4)
      add('image_limit', 'Use no more than four source images.')
    if (
      content.outcomeStatus === 'not_measured' &&
      !content.sections.some((s) =>
        s.blocks.some((b) =>
          /\bnot\s+(?:(?:yet|been)\s+)*(?:measured|evaluated)\b|\bno\s+measured\b/i.test(
            blockText(b)
          )
        )
      )
    )
      add('unmeasured_statement', 'State explicitly that outcomes have not been measured.')
    for (const section of content.sections)
      for (const block of section.blocks) {
        const anchor = {
          sectionKey: section.key,
          blockId: block.id,
          ...this.claim(block, manifest),
        }
        if (block.evidenceIds.some((id) => !manifest.some((e) => e.id === id)))
          add(
            'unknown_evidence',
            'This block references evidence outside the pinned manifest.',
            'blocking',
            anchor
          )
        if (block.type === 'image') {
          const source = manifest.find((e) => e.id === block.sourceChunkId && e.kind === 'image')
          if (
            setup.imagePolicy === 'none' ||
            !source ||
            !block.evidenceIds.includes(block.sourceChunkId) ||
            (setup.imagePolicy === 'source_only' &&
              !setup.imageChunkIds.includes(block.sourceChunkId))
          )
            add(
              'image_policy',
              'Select an eligible source image or remove this image.',
              'blocking',
              anchor
            )
          if (!block.alt.trim() || !block.caption.trim())
            add(
              'image_description',
              'Source images need a caption and alternative text.',
              'blocking',
              anchor
            )
          if (setup.audience === 'public' && block.disposition !== 'public_approved')
            add(
              'image_review',
              'Confirm that this source image is cleared for the public audience.',
              'blocking',
              anchor
            )
          const imageReview = reviews.findLast(
            (v) => v.claim_hash === anchor.claimHash && v.evidence_hash === anchor.evidenceHash
          )
          if (!imageReview || imageReview.decision !== 'supported')
            add(
              'image_review',
              'Review the exact source image, caption and audience clearance.',
              'blocking',
              anchor
            )
          continue
        }
        if (
          block.type === 'comparison_table' &&
          block.rows.some((row) => row.length !== block.columns.length)
        )
          add('table_shape', 'Each comparison row must match the columns.', 'blocking', anchor)
        if (
          block.type === 'metric_table' &&
          block.rows.some(
            (row) =>
              !row.value.trim() || !row.unit.trim() || !row.scope.trim() || !row.methodology.trim()
          )
        )
          add(
            'metric_context',
            'Metrics need value, units, scope and methodology.',
            'blocking',
            anchor
          )
        const review = reviews.findLast(
          (v) => v.claim_hash === anchor.claimHash && v.evidence_hash === anchor.evidenceHash
        )
        if (review?.decision === 'contradicted' || review?.decision === 'unsupported')
          add('claim_rejected', 'Resolve the rejected claim.', 'blocking', anchor)
        else if (!review || !['supported', 'user_assertion_accepted'].includes(review.decision))
          add(
            'claim_unverified',
            'Review this exact text against its evidence or accept it as an attributed user assertion.',
            'blocking',
            anchor
          )
      }
    return issues
  }
  project(content: CanonicalContent, template: TemplateDefinition): TipTapDocument {
    const p = (text: string) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })
    return {
      type: 'doc',
      content: content.sections.flatMap((s) => [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: template.sections.find((d) => d.key === s.key)?.heading ?? s.key,
            },
          ],
        },
        ...s.blocks.flatMap((b) =>
          b.type === 'image'
            ? []
            : b.type === 'paragraph'
              ? [
                  {
                    type: 'paragraph',
                    content: segments(b).map((segment) => ({ type: 'text', ...segment })),
                  },
                ]
              : [p(blockText(b))]
        ),
      ]),
    }
  }
}
