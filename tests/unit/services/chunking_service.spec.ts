import { test } from '@japa/runner'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { countTokens } from 'gpt-tokenizer'
import type { Worker } from 'tesseract.js'
import drive from '@adonisjs/drive/services/main'
import FileService from '#services/documents/files_service'
import ChunkingService, { MAX_CHUNK_TOKENS } from '#services/documents/chunking_service'
import ContextualizationService from '#services/documents/contextualization_service'
import { embeddingInput } from '#services/documents/embedding_service'
import type { CanonicalBlock } from '#services/documents/rag_types'

const context = {
  actorId: 1,
  workspaceId: '00000000-0000-4000-8000-000000000001',
  membershipId: '00000000-0000-4000-8000-000000000002',
  membershipEpoch: 0,
}
const EMBEDDING_LIMIT = 700
const CONTEXT_BUDGET = 120

async function prepare(name: string) {
  const bytes = await readFile(new URL(`../../fixtures/pdf/${name}`, import.meta.url))
  const originalUse = drive.use
  drive.use = () => ({ getStream: async () => Readable.from([bytes]), put: async () => {} }) as any
  const service = FileService as unknown as { createOcrWorker: () => Promise<Worker> }
  const originalWorker = service.createOcrWorker
  service.createOcrWorker = async () =>
    ({
      recognize: async () => ({ data: { text: 'OCR text', confidence: 90 } }),
      terminate: async () => {},
    }) as unknown as Worker
  try {
    const extracted = await FileService.processFile(
      { uploaderId: 1, id: name, filename: name, objectKey: `uploads/1/${name}` },
      context,
      async () => {}
    )
    const chunked = await new ChunkingService().chunk(extracted.blocks, extracted.chunkPlan)
    return await new ContextualizationService(null).contextualize(
      chunked,
      { title: extracted.title, fileName: name },
      async () => {}
    )
  } finally {
    drive.use = originalUse
    service.createOcrWorker = originalWorker
  }
}

const block = (text: string, extra: Partial<CanonicalBlock> = {}): CanonicalBlock => ({
  id: randomUUID(),
  blockType: 'paragraph',
  text,
  orderIndex: 0,
  sectionPath: [],
  sourceLocator: { fileKey: 'k', fileUrl: 'u', fileName: 'f.pdf', mediaType: 'application/pdf' },
  extractionMethod: 'test',
  confidence: null,
  ...extra,
})

test.group('ChunkingService | structure-aware plans', (group) => {
  // The first PDF starts a PyMuPDF worker, which can take a few seconds on a cold machine.
  group.each.timeout(30_000)
  test('no chunk crosses a section and every chunk names its section', async ({ assert }) => {
    const { blocks, chunks } = await prepare('sections.pdf')
    const sectionOf = new Map(blocks.map((item) => [item.id, item.sectionPath.join(' > ')]))
    for (const chunk of chunks) {
      const sections = new Set(chunk.blockIds.map((id) => sectionOf.get(id)))
      assert.equal(sections.size, 1, `chunk ${chunk.chunkIndex} spans ${[...sections].join(', ')}`)
      assert.notMatch(chunk.content, /^Section:/) // content is pure source text (D4)
      assert.match(chunk.context!, /^Acme Warehouse Modernisation/)
      assert.equal(chunk.contextSource, 'structural')
    }
    assert.include(
      chunks.map((chunk) => chunk.context),
      'Acme Warehouse Modernisation › Approach › Scanning app — page 2'
    )
  })

  test('tables are their own chunks and start with the header row', async ({ assert }) => {
    const { chunks } = await prepare('tables.pdf')
    const tables = chunks.filter((chunk) => chunk.content.includes(' | '))
    assert.lengthOf(tables, 2)
    assert.include(tables[0].content, 'Metric | Before | After\nCount time | 3 h | 20 min')
    assert.include(tables[1].content, 'Site | Go-live\nGlasgow | March\nLeeds | April')
    assert.notInclude(tables[0].content, 'Site |')
  })

  test('a split table repeats its header on the continuation chunk', async ({ assert }) => {
    const header = 'Metric | Value'
    const rows = [
      block(header, { blockType: 'table_row' }),
      ...Array.from({ length: 4 }, (_, index) =>
        block(`row ${index} | ${'value '.repeat(60)}`, { blockType: 'table_row' })
      ),
    ]
    const { chunks } = await new ChunkingService().chunk(rows, [
      { blockIds: rows.slice(0, 3).map((row) => row.id), header: null },
      { blockIds: rows.slice(3).map((row) => row.id), header },
    ])
    assert.lengthOf(chunks, 2)
    assert.isTrue(chunks[1].content.startsWith(`${header}\nrow 2`))
  })

  test('oversized planned text is re-split so every part stays within the budget', async ({
    assert,
  }) => {
    const heading = block('Results', {
      blockType: 'heading',
      sourceLocator: { ...block('').sourceLocator, headingLevel: 1 },
    })
    const long = block('The rollout reduced count time across every site. '.repeat(120))
    const { chunks } = await new ChunkingService().chunk(
      [heading, long],
      [{ blockIds: [long.id], header: null }]
    )
    assert.isAbove(chunks.length, 1)
    for (const chunk of chunks) {
      assert.isAtMost(chunk.tokenCount, MAX_CHUNK_TOKENS)
      assert.notMatch(chunk.content, /^Section:/)
    }
  })

  test('no embedding input can exceed the embedding limit for any fixture', async ({ assert }) => {
    assert.isBelow(MAX_CHUNK_TOKENS + CONTEXT_BUDGET + 2, EMBEDDING_LIMIT)
    for (const name of [
      'sections.pdf',
      'tables.pdf',
      'two_column.pdf',
      'figure.pdf',
      'scanned.pdf',
    ]) {
      const { chunks } = await prepare(name)
      assert.isAbove(chunks.length, 0, name)
      for (const chunk of chunks) {
        assert.isAtMost(countTokens(chunk.content), MAX_CHUNK_TOKENS, name)
        assert.isAtMost(countTokens(chunk.context!), CONTEXT_BUDGET, name)
        assert.isBelow(countTokens(embeddingInput(chunk)), EMBEDDING_LIMIT, name)
      }
    }
  })
})
