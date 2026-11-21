import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import config from '#config/open_router'
import Project from '#models/project'
import BriefService from '#services/documents/brief_service'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import { account, reset, source } from '../helpers/workspaces.ts'

const vector = (axis: number) =>
  Array.from({ length: config.embeddingDimensions }, (_, i) => (i === axis ? 1 : 0))

/** Adds chunks to a fixture source's run, each with its own embedding axis. */
async function addChunks(
  owner: Awaited<ReturnType<typeof account>>,
  fixture: Awaited<ReturnType<typeof source>>,
  chunks: { index: number; content: string; tokens: number; axis: number }[]
) {
  const ws = owner.context.workspaceId
  for (const chunk of chunks) {
    const id = randomUUID()
    await db.table('chunks').insert({
      id,
      workspace_id: ws,
      file_id: fixture.file.id,
      file_revision_id: fixture.pin.revisionId,
      run_id: fixture.pin.runId,
      chunk_index: chunk.index,
      content: chunk.content,
      kind: 'text',
      token_count: chunk.tokens,
    })
    await db.table('chunk_blocks').insert({
      workspace_id: ws,
      run_id: fixture.pin.runId,
      chunk_id: id,
      document_block_id: fixture.blockId,
    })
    await db.rawQuery(
      'INSERT INTO chunk_embeddings(workspace_id,chunk_id,model,version,dimensions,embedding,input_hash) VALUES(?,?,?,?,?,?::vector,?)',
      [
        ws,
        id,
        config.embeddingModel,
        config.pipelineVersion,
        config.embeddingDimensions,
        JSON.stringify(vector(chunk.axis)),
        'a'.repeat(64),
      ]
    )
  }
}

function stubModel() {
  const seen: { chunks: SourceChunk[]; input: { project: string | null; draft: string | null } }[] =
    []
  const original = OpenRouterService.prototype.generateBrief
  OpenRouterService.prototype.generateBrief = async function (input, chunks) {
    seen.push({ input, chunks })
    return 'One. Two. Three.'
  }
  return { seen, restore: () => (OpenRouterService.prototype.generateBrief = original) }
}

test.group('Case study brief generation', (group) => {
  group.each.setup(reset)

  test('small sources are sent whole, scoped to the workspace, selection and project', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const picked = await source(a, false)
    const inProject = await source(a, false)
    const unrelated = await source(a, false)
    const foreign = await source(b, false)
    const project = await Project.create({
      workspaceId: a.context.workspaceId,
      creatorId: a.user.id,
      name: 'Harbour app',
    })
    await db.table('project_files').insert({
      workspace_id: a.context.workspaceId,
      project_id: project.id,
      file_id: inProject.file.id,
    })
    const model = stubModel()
    try {
      const result = await new BriefService().generate(a.context, {
        projectId: project.id,
        fileIds: [picked.file.id, foreign.file.id],
        draft: 'Focus on the launch',
      })
      assert.equal(result.mode, 'all')
      assert.equal(result.brief, 'One. Two. Three.')
      const ids = model.seen[0].chunks.map((chunk) => chunk.id)
      assert.sameMembers(ids, [picked.chunkId, inProject.chunkId])
      assert.notInclude(ids, unrelated.chunkId)
      assert.notInclude(ids, foreign.chunkId)
      assert.deepEqual(model.seen[0].input, {
        project: 'Harbour app',
        draft: 'Focus on the launch',
      })
    } finally {
      model.restore()
    }
  })

  test('large sources are retrieved within budget, covering every facet and file', async ({
    assert,
  }) => {
    const a = await account()
    const big = await source(a, false)
    const other = await source(a, false)
    // 30 chunks of 900 tokens is far over the whole-context limit. Each facet query embeds on
    // its own axis (1-4); chunks on those axes are the ones each facet should find.
    await addChunks(
      a,
      big,
      Array.from({ length: 30 }, (_, i) => ({
        index: i + 1,
        content: `Passage ${i + 1}`,
        tokens: 900,
        axis: i < 4 ? i + 1 : 10 + i,
      }))
    )
    const facets = ['client', 'problem', 'solution', 'results']
    const originalEmbed = EmbeddingService.prototype.embedQuery
    EmbeddingService.prototype.embedQuery = async (text: string) =>
      vector(1 + facets.findIndex((facet) => text.toLowerCase().includes(facet)))
    const model = stubModel()
    try {
      const result = await new BriefService().generate(a.context, {
        fileIds: [big.file.id, other.file.id],
      })
      assert.equal(result.mode, 'retrieved')
      const chunks = model.seen[0].chunks
      const contents = chunks.map((chunk) => chunk.content)
      for (const n of [1, 2, 3, 4]) assert.include(contents, `Passage ${n}`)
      // Each file's opening passage is kept, so the small file is not crowded out.
      assert.include(
        chunks.map((chunk) => chunk.id),
        other.chunkId
      )
      const tokens = chunks.reduce(
        (sum, chunk) => sum + (chunk.content.startsWith('Passage') ? 900 : 2),
        0
      )
      assert.isAtMost(tokens, 8000)
      // Reading order within a file.
      const indexes = chunks
        .filter(
          (chunk) => chunk.fileName === big.file.filename && chunk.content !== 'Private evidence'
        )
        .map((chunk) => chunk.chunkIndex)
      assert.deepEqual(
        indexes,
        [...indexes].sort((x, y) => x - y)
      )
    } finally {
      model.restore()
      EmbeddingService.prototype.embedQuery = originalEmbed
    }
  })

  test('explains when there is nothing to read yet', async ({ assert }) => {
    const a = await account()
    await assert.rejects(() => new BriefService().generate(a.context, {}), /Choose a project/)
    const pending = await source(a, false)
    await db.from('processing_runs').where('id', pending.pin.runId).update({ status: 'processing' })
    await assert.rejects(
      () => new BriefService().generate(a.context, { fileIds: [pending.file.id] }),
      /still being prepared/
    )
  })
})
