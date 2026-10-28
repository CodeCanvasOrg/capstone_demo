import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'
import Document from '#models/document'
import CreationService from '#services/documents/creation_service'
import LegacyTemplateService from '#services/documents/legacy_template_service'
import VersionService from '#services/documents/version_service'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import db from '@adonisjs/lucid/services/db'
import { templateContent } from '../fixtures/template_content.ts'
import * as historicalCatalog from '../../shared/templates/catalog.ts'
import { randomUUID } from 'node:crypto'

test.group('Company template integration', (group) => {
  group.each.setup(reset)
  test('catalog is read-only, authorized, and rejects arbitrary IDs at creation', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const url = `/workspaces/${a.workspace.id}/templates`
    const catalog = await client.get(url).loginAs(a.user)
    catalog.assertStatus(200)
    assert.deepEqual(
      catalog.body().data.map((item: { id: string }) => item.id),
      ['portfolio', 'technical', 'vision']
    )
    const foreign = await client.get(url).loginAs(b.user).header('accept', 'application/json')
    foreign.assertStatus(404)
    const write = await client
      .post(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ name: 'Custom template' })
    write.assertStatus(404)
    const invalid = await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: 'Invalid template', templateId: '../../.env' })
    invalid.assertStatus(422)
    assert.isNull(await Document.findBy('title', 'Invalid template'))
  })
  test('creation pins the selected company guide and queues normal generation', async ({
    assert,
  }) => {
    const a = await account()
    const doc = await new CreationService().document(
      a.context,
      { title: 'Technical story', templateId: 'technical', sourceMode: 'input_only' },
      []
    )
    await doc.refresh()
    assert.equal(doc.contentMode, 'legacy')
    assert.equal(doc.templateSetup.outline.id, 'technical')
    assert.include(doc.templateSetup.outline.definition.instructions, 'Technical Approach')
    assert.isNull(doc.selectedTemplateVersionId)
    assert.isNull(doc.currentVersionId)
    assert.equal(doc.generationStatus, 'processing')
    const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
    assert.equal(task.status, 'queued')
    assert.notProperty(task.payload, 'templateMode')
  })
  test('conversion preserves the old version and is idempotent, and preview remains private', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const version = await DocumentVersion.create({
      documentId: a.document.id,
      workspaceId: a.workspace.id,
      userId: a.user.id,
      version: 1,
      mutationId: randomUUID(),
      requestHash: 'a'.repeat(64),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Preserve existing work' }] },
        ],
      },
    })
    await a.document.merge({ contentMode: 'template', currentVersionId: version.id }).save()
    const service = new LegacyTemplateService()
    assert.isTrue(await service.convert(a.context, a.document.id))
    assert.isFalse(await service.convert(a.context, a.document.id))
    await a.document.refresh()
    const versions = await a.document.related('documentVersions').query().orderBy('version')
    assert.lengthOf(versions, 2)
    assert.deepEqual(versions[0].content, version.content)
    assert.deepEqual(versions[1].content, version.content)
    assert.equal(versions[1].parentVersionId, version.id)
    const preview = `/workspaces/${a.workspace.id}/documents/${a.document.id}/preview`
    const response = await client.get(preview).loginAs(a.user)
    response.assertStatus(200)
    assert.include(response.text(), 'Preserve existing work')
    response.assertHeader('cache-control', 'private, no-store')
    const denied = await client.get(preview).loginAs(b.user).header('accept', 'application/json')
    denied.assertStatus(404)
    // Saving remains ordinary version creation after conversion.
    await new VersionService().save(a.context, a.document.id, {
      baseVersionId: versions[1].id,
      mutationId: randomUUID(),
      content: version.content,
    })
  })
  test('converts an immutable canonical version without rewriting its original envelope', async ({
    assert,
  }) => {
    const a = await account()
    const definition = historicalCatalog.SYSTEM_TEMPLATES[1]
    const [template] = await db
      .table('document_templates')
      .insert({ workspace_id: a.workspace.id, key: 'conversion-fixture', name: definition.name })
      .returning('id')
    const [published] = await db
      .table('document_template_versions')
      .insert({
        template_id: template.id,
        version: 1,
        state: 'published',
        definition,
        definition_hash: 'a'.repeat(64),
      })
      .returning('id')
    await a.document
      .merge({ contentMode: 'template', selectedTemplateVersionId: published.id })
      .save()
    const canonical = templateContent(definition)
    const old = await DocumentVersion.create({
      documentId: a.document.id,
      workspaceId: a.workspace.id,
      userId: a.user.id,
      version: 1,
      mutationId: randomUUID(),
      requestHash: 'a'.repeat(64),
      content: { type: 'doc', content: [] },
      canonicalContent: canonical,
      contentSchemaVersion: 1,
      templateVersionId: published.id,
      contentHash: 'a'.repeat(64),
      sourceManifest: [],
      generationSnapshot: { setup: { templateVersionId: published.id } },
      renderConfiguration: {},
      snapshotHash: 'a'.repeat(64),
    })
    await a.document.merge({ currentVersionId: old.id }).save()
    await new LegacyTemplateService().convert(a.context, a.document.id)
    await old.refresh()
    await a.document.refresh()
    assert.deepEqual(old.canonicalContent, canonical)
    assert.equal(a.document.templateSetup.outline.id, 'technical')
    const current = await DocumentVersion.findOrFail(a.document.currentVersionId!)
    assert.isNull(current.canonicalContent)
    assert.include(JSON.stringify(current.content), 'Grounded project narrative')
    assert.include(JSON.stringify(current.content), definition.sections[0].heading)
    assert.equal(current.parentVersionId, old.id)
  })
})
