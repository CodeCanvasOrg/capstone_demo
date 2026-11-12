import { test } from '@japa/runner'
import GenerationService from '#services/documents/generation_service'
import PublicationContentService, {
  deterministicId,
} from '#services/documents/publication_content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import ExportPdfService from '#services/exports/pdf_service'
import {
  describeField,
  nodeIdForField,
  type PublicationDocument,
} from '../../shared/publication/content.ts'
import { responseError } from '../../shared/ui_feedback.ts'
import { legacyCaseStudy } from '../fixtures/publication/legacy_case_study.ts'

const service = new PublicationContentService()
const project = (document: unknown) => new PublicationProjectionService().project(document as any)
/** Layouts take the client data only, so every render goes through the projector. */
const html = (document: unknown, options = {}) =>
  ExportPdfService.html(project(document).client, options)
const plain = () => {
  const doc = structuredClone(legacyCaseStudy)
  doc.content = doc.content.filter((node) => node.type !== 'image')
  return doc
}

/** Mapped case study with one estimated result and a private reviewer note. */
function annotated() {
  const { document } = service.mapLegacy(plain(), 'ns')
  const meta = document.attrs!.publication as any
  const paragraph = document.content[3]
  const nodeId = paragraph.attrs!.nodeId as string
  const claimId = deterministicId('claim')
  const text = 'Onboarding took weeks\nup to 30% faster is the target.'
  const phrase = 'up to 30%'
  const from = text.indexOf(phrase)
  meta.claims = [
    {
      id: claimId,
      state: 'active',
      text: service.anchor(document, nodeId, 0, text.length),
      authorship: 'unknown',
      evidenceRefIds: [],
    },
  ]
  meta.results = [
    {
      id: deterministicId('res'),
      state: 'active',
      claimId,
      value: service.anchor(document, nodeId, from, from + phrase.length),
      qualifier: 'estimated',
      units: '%',
      baseline: 'Q1 onboarding',
    },
  ]
  meta.reviewerNotes = [{ id: deterministicId('note'), message: 'PRIVATE NOTE' }]
  return document
}

test.group('Projection reads the semantic contract', () => {
  test('hero is found by ID, not position, and results carry author context', ({ assert }) => {
    const document = annotated()
    // A preamble block before the title would break the positional heuristic.
    document.content.unshift({
      type: 'paragraph',
      attrs: { nodeId: deterministicId('pre') },
      content: [{ type: 'text', text: 'Preamble' }],
    })
    const { client } = project(document)
    assert.equal(client.title, 'Faster onboarding')
    const summary = client.summary?.content?.[0]
    assert.equal(summary?.type === 'text' && summary.text, 'Summary of the work 🚀.')
    const first = client.body[0]
    assert.equal(first.type === 'paragraph' && first.content?.[0].type, 'text')
    assert.include(JSON.stringify(first), 'Preamble')
    assert.deepEqual(client.results, [
      { value: 'up to 30%', qualifier: 'estimated', units: '%', baseline: 'Q1 onboarding' },
    ])
  })

  test('notes, IDs and annotation records never reach the client projection or HTML', async ({
    assert,
  }) => {
    const document = annotated()
    const before = JSON.stringify(document)
    const serialized = JSON.stringify(project(document))
    for (const secret of ['PRIVATE NOTE', 'claimHash', 'nodeId', 'evidenceRefIds'])
      assert.notInclude(serialized, secret)
    assert.equal(JSON.stringify(document), before, 'saved body is untouched')
    const rendered = await html(document, { publication: true })
    assert.include(rendered, 'Key results')
    assert.include(rendered, 'up to 30%')
    assert.include(rendered, 'Estimated')
    assert.include(rendered, 'baseline: Q1 onboarding')
    assert.notInclude(rendered, 'PRIVATE NOTE')
  })

  test('stale results are not rendered as structured data but prose stays', async ({ assert }) => {
    const document = annotated()
    document.content[3].content![0].text = 'Rewritten '
    const accepted = service.accept(document)
    assert.notProperty(project(accepted).client, 'results')
    const out = await html(accepted, { publication: true })
    assert.notInclude(out, 'Key results')
    assert.include(out, 'Rewritten')
  })

  test('documents without usable metadata keep the positional pilot output', ({ assert }) => {
    const projected = project(plain())
    assert.notProperty(projected.client, 'results')
    assert.equal(projected.client.title, 'Faster onboarding')
    const broken = annotated()
    ;(broken.attrs!.publication as any).hero.title.nodeId = deterministicId('gone')
    const fallback = project(broken)
    assert.notProperty(fallback.client, 'results')
    assert.equal(fallback.client.title, 'Faster onboarding')
  })
})

test.group('Generation mapping step', () => {
  const annotate = (content: PublicationDocument, namespace: string) =>
    (new GenerationService() as any).annotate(content, namespace) as PublicationDocument

  test('maps model output deterministically and ignores model-proposed identity', ({ assert }) => {
    const model = plain()
    model.content[0].attrs = { level: 1, nodeId: 'not-a-uuid' }
    const first = annotate(model, 'doc:task-1')
    assert.deepEqual(first, annotate(model, 'doc:task-1'))
    assert.equal((first.attrs!.publication as any).docType, 'case_study')
    assert.isUndefined((first.attrs!.publication as any).claims)
    assert.notEqual(first.content[0].attrs!.nodeId, 'not-a-uuid')
    assert.notDeepEqual(first, annotate(model, 'doc:task-2'))
  })

  test('a draft that cannot be mapped stays an ordinary document', ({ assert }) => {
    const untitled: PublicationDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No title' }] }],
    }
    assert.deepEqual(annotate(untitled, 'ns'), untitled)
  })
})

test.group('Field error summary helpers', () => {
  test('describeField and nodeIdForField resolve readable names and anchors', ({ assert }) => {
    const document = annotated()
    const meta = document.attrs!.publication
    assert.equal(
      describeField('content.attrs.publication.hero.title.nodeId'),
      'Hero · title · link'
    )
    assert.equal(
      describeField('content.attrs.publication.results.0.qualifier'),
      'Result 1 · qualifier'
    )
    assert.equal(describeField('content.attrs.nodeId'), 'Document content')
    assert.equal(
      nodeIdForField(meta, 'content.attrs.publication.hero.title.nodeId'),
      document.content[0].attrs!.nodeId
    )
    const paragraph = document.content[3].attrs!.nodeId
    assert.equal(nodeIdForField(meta, 'content.attrs.publication.results.0.value'), paragraph)
    assert.equal(nodeIdForField(meta, 'content.attrs.publication.results.0.claimId'), paragraph)
    assert.isNull(nodeIdForField(meta, 'content.attrs.nodeId'))
  })

  test('publication messages survive the client error adapter', ({ assert }) => {
    const error = responseError(422, {
      error: { code: 'E_PUBLICATION_CONTENT', message: 'Check the highlighted content fields.' },
      errors: [
        {
          field: 'content.attrs.publication.results.0.qualifier',
          message: 'Choose measured, estimated, client_reported or design_target.',
        },
      ],
    })
    assert.equal(
      error.details['content.attrs.publication.results.0.qualifier'],
      'Choose measured, estimated, client_reported or design_target.'
    )
    const other = responseError(422, {
      error: { code: 'E_VALIDATION_ERROR', message: 'x' },
      errors: [{ field: 'title', message: 'Some server detail' }],
    })
    assert.equal(other.details.title, 'Check this value.')
  })
})
