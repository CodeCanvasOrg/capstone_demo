import { test } from '@japa/runner'
import { account, reset, source } from '../helpers/workspaces.ts'
import EvidenceService from '#services/documents/evidence_service'
import RetrievalService from '#services/documents/retrieval_service'
import EmbeddingService from '#services/documents/embedding_service'
import config from '#config/open_router'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import { Readable } from 'node:stream'
test.group('Workspace retrieval', (group) => {
  group.each.setup(reset)
  test('dense, lexical, supplemental images and source expansion exclude other and unselected files', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const selected = await source(a)
    const image = await source(a, true, true)
    const unselected = await source(a, false, true)
    const other = await source(b, true, true)
    const original = EmbeddingService.prototype.embedQuery
    const originalDrive = drive.use
    EmbeddingService.prototype.embedQuery = async () =>
      Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))
    const keys: string[] = []
    const imageBytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer()
    drive.use = () =>
      ({
        getStream: async (key: string) => {
          keys.push(key)
          return Readable.from([imageBytes])
        },
      }) as any
    try {
      const chunks = await new RetrievalService().search({
        context: a.context,
        documentId: a.document.id,
        pins: [selected.pin, image.pin, unselected.pin, other.pin],
        query: 'Private evidence',
        guard: () => new EvidenceService().check(a.context),
      })
      assert.sameMembers(
        chunks.map((chunk) => chunk.id),
        [selected.chunkId, image.chunkId]
      )
      assert.sameMembers(keys, [image.file.objectKey!])
      assert.match(
        chunks.find((chunk) => chunk.id === image.chunkId)!.modelFileUrl!,
        /^data:image\/jpeg;base64,/
      )
      keys.length = 0
      await new RetrievalService().search({
        context: a.context,
        documentId: a.document.id,
        pins: [image.pin],
        query: 'Private evidence',
        imageMode: 'none',
        guard: () => new EvidenceService().check(a.context),
      })
      assert.isEmpty(keys)
      await assert.rejects(() =>
        new EvidenceService().chunk(a.context, a.document.id, unselected.chunkId)
      )
      await assert.rejects(() =>
        new EvidenceService().chunk(a.context, a.document.id, other.chunkId)
      )
      await db.from('processing_runs').where('id', selected.pin.runId).update({ status: 'failed' })
      const after = await new EvidenceService().rows(a.context, a.document.id, undefined, [
        selected.pin,
      ])
      assert.lengthOf(after, 0)
    } finally {
      EmbeddingService.prototype.embedQuery = original
      drive.use = originalDrive
    }
  })
})
