import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import DocumentVersion from '#models/document_version'
import PublicationContentService from '#services/documents/publication_content_service'
import { flattenText } from '../../shared/publication/content.ts'
import { account, reset } from '../helpers/workspaces.ts'
import { legacyCaseStudy } from '../fixtures/publication/legacy_case_study.ts'

const withoutEvidence = () => {
  const doc = structuredClone(legacyCaseStudy)
  // Evidence needs real chunks; this slice checks structure, identity and errors.
  doc.content = doc.content.filter((node) => node.type !== 'image')
  const paragraph = doc.content[3]
  paragraph.content = paragraph.content!.filter((child) => child.type !== 'sourceCitation')
  return doc
}

test.group('Publication content save', (group) => {
  group.each.setup(reset)

  const save = (client: any, a: any, body: object) =>
    client
      .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/versions`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json(body)

  test('annotated content keeps metadata and IDs, replays, and reports field errors', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const { document } = new PublicationContentService().mapLegacy(withoutEvidence(), 'ns')
    const mutationId = randomUUID()
    const first = await save(client, a, { baseVersionId: null, mutationId, content: document })
    first.assertStatus(200)
    const version = first.body().data.version
    const stored = await DocumentVersion.findOrFail(version.id)
    const content = stored.content as any
    assert.deepEqual(content.attrs.publication, document.attrs!.publication)
    assert.equal(content.content[0].attrs.nodeId, document.content[0].attrs!.nodeId)

    // Same mutation and content replays the same version.
    const replay = await save(client, a, { baseVersionId: null, mutationId, content: document })
    replay.assertStatus(200)
    assert.equal(replay.body().data.version.id, version.id)

    // Invalid explicit metadata: 422 with exact field path and no content echo.
    const bad = structuredClone(document) as any
    bad.attrs.publication.hero.title.nodeId = randomUUID()
    const rejected = await save(client, a, {
      baseVersionId: version.id,
      mutationId: randomUUID(),
      content: bad,
    })
    rejected.assertStatus(422)
    assert.equal(rejected.body().error.code, 'E_PUBLICATION_CONTENT')
    assert.equal(rejected.body().errors[0].field, 'content.attrs.publication.hero.title.nodeId')
    assert.notInclude(JSON.stringify(rejected.body()), 'Faster onboarding')

    // A figure whose asset the actor cannot use never reaches storage.
    const forged = structuredClone(document) as any
    const chunk = randomUUID()
    forged.content.push({ type: 'image', attrs: { nodeId: randomUUID(), sourceChunkId: chunk } })
    forged.attrs.publication.figures = [
      {
        id: randomUUID(),
        image: { nodeId: forged.content.at(-1).attrs.nodeId },
        asset: { kind: 'source_chunk', id: chunk },
      },
    ]
    const dropped = await save(client, a, {
      baseVersionId: version.id,
      mutationId: randomUUID(),
      content: forged,
    })
    dropped.assertStatus(422)
    assert.equal(dropped.body().errors[0].field, 'content.attrs.publication.figures.0.asset')
    const versions = await DocumentVersion.query().where('documentId', a.document.id)
    assert.lengthOf(versions, 1)
  })

  test('a stale base version is still a 409', async ({ client }) => {
    const a = await account()
    const { document } = new PublicationContentService().mapLegacy(withoutEvidence(), 'ns')
    const first = await save(client, a, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: document,
    })
    first.assertStatus(200)
    const stale = await save(client, a, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: document,
    })
    stale.assertStatus(409)
  })

  test('editing claimed text saves, keeps the prose and reports the paused link', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const content = new PublicationContentService()
    const { document } = content.mapLegacy(withoutEvidence(), 'ns')
    const paragraph = document.content[3]
    // The JSON bodyparser trims text runs, so anchor to text that is stable under trimming.
    paragraph.content![0].text = 'Onboarding took'
    const text = flattenText(paragraph)
    ;(document.attrs!.publication as any).claims = [
      {
        id: randomUUID(),
        state: 'active',
        text: content.anchor(document, paragraph.attrs!.nodeId as string, 0, text.length),
        authorship: 'unknown',
        evidenceRefIds: [],
      },
    ]
    const first = await save(client, a, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: document,
    })
    first.assertStatus(200)
    assert.isUndefined(first.body().data.publication)
    const edited = structuredClone(document)
    edited.content[3].content![0].text = 'Rewritten '
    const second = await save(client, a, {
      baseVersionId: first.body().data.version.id,
      mutationId: randomUUID(),
      content: edited,
    })
    second.assertStatus(200)
    assert.deepEqual(second.body().data.publication, { needsReview: 1 })
    const row = await DocumentVersion.findOrFail(second.body().data.version.id)
    const stored = row.content as any
    assert.equal(stored.attrs.publication.claims[0].state, 'needs_review')
    assert.include(JSON.stringify(stored), 'Rewritten')
  })
})
