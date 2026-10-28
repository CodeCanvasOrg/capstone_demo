import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import config from '#config/open_router'
import contextualization from '#config/contextualization'
import ProcessingRun from '#models/processing_run'
import EmbeddingService, { embeddingInput } from '#services/documents/embedding_service'
import EvidenceService from '#services/documents/evidence_service'
import UploadService from '#services/upload_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { account, reset } from '../helpers/workspaces.ts'

const vector = () => Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))

test.group('Contextual chunking end to end', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())

  test('a prepared PDF stores context separately, indexes it, and never cites it', async ({
    assert,
  }) => {
    const a = await account()
    const embedded: string[] = []
    const original = EmbeddingService.prototype.embedTexts
    EmbeddingService.prototype.embedTexts = async (texts: string[]) => {
      embedded.push(...texts)
      return texts.map(vector)
    }
    try {
      const uploaded = await new UploadService().upload(a.context, {
        filename: 'sections.pdf',
        contents: await readFile(new URL('../fixtures/pdf/sections.pdf', import.meta.url)),
      })
      await new TaskDispatchService().dispatch()

      const run = await ProcessingRun.query()
        .whereHas('revision', (revision) => revision.where('fileId', uploaded.id))
        .firstOrFail()
      assert.equal(run.status, 'ready')
      assert.equal(run.contextualizer, contextualization.identity)
      assert.equal(run.extractor, 'pymupdf:2.0')

      const chunks = await db
        .from('chunks')
        .where({ workspace_id: a.workspace.id, file_id: uploaded.id })
        .orderBy('chunk_index')
      assert.isAbove(chunks.length, 1)
      for (const chunk of chunks) {
        assert.isString(chunk.context)
        assert.equal(chunk.context_source, 'structural')
        assert.notMatch(chunk.content, /^Section:/)
      }
      // The embedded text and its hash describe context + content.
      assert.deepEqual(
        embedded,
        chunks.map((chunk) => embeddingInput({ content: chunk.content, context: chunk.context }))
      )
      const hashes = await db
        .from('chunk_embeddings')
        .whereIn(
          'chunk_id',
          chunks.map((chunk) => chunk.id)
        )
        .select('chunk_id', 'input_hash')
      const service = new EmbeddingService()
      for (const chunk of chunks)
        assert.equal(
          hashes.find((row) => row.chunk_id === chunk.id).input_hash,
          service.inputHash(embeddingInput({ content: chunk.content, context: chunk.context }))
        )

      // "Modernisation" only appears in the title/H1, i.e. only in context: full-text still finds it.
      assert.isFalse(chunks.some((chunk) => /modernisation/i.test(chunk.content)))
      const lexical = await db
        .from('chunks')
        .where({ file_id: uploaded.id })
        .whereRaw("content_tsv @@ plainto_tsquery('english', 'modernisation')")
        .count('* as total')
        .first()
      assert.equal(Number(lexical.total), chunks.length)

      // Evidence handed to generation is the source text plus its section label, never the context.
      await db
        .table('document_files')
        .insert({ workspace_id: a.workspace.id, document_id: a.document.id, files_id: uploaded.id })
      const rows = await new EvidenceService().rows(a.context, a.document.id)
      const evidence = rows.map((row) =>
        new EvidenceService().source(a.context, a.document.id, row)
      )
      const scanning = evidence.find((item) => item.content.includes('barcode scanning app'))!
      assert.equal(scanning.section, 'Acme Warehouse Modernisation > Approach > Scanning app')
      assert.notInclude(scanning.content, '›')
      assert.notProperty(scanning, 'context')
    } finally {
      EmbeddingService.prototype.embedTexts = original
    }
  }).timeout(60_000)
})
