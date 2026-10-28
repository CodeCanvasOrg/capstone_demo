import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { randomUUID } from 'node:crypto'
import WorkspaceService from '#services/workspaces/workspace_service'
import AccessService from '#services/workspaces/access_service'
import DocumentService from '#services/documents/document_service'
import File from '#models/file'
import config from '#config/open_router'
import contextualization from '#config/contextualization'
export async function reset() {
  if (!env.get('TEST_DB_URL')?.endsWith('/capstone_tenancy_test'))
    throw new Error('Requires disposable tenancy test database')
  await db.rawQuery('TRUNCATE users CASCADE')
}
export async function account(email = 'alice@example.test') {
  const user = await new WorkspaceService().register({ email, password: 'test-password-123' })
  const access = await new AccessService().resolve(user.id, user.lastWorkspaceId!)
  const document = await new DocumentService().create(
    access.context,
    { title: 'Evidence example', sourceMode: 'input_only' },
    []
  )
  return { user, ...access, document }
}
export async function source(
  owner: Awaited<ReturnType<typeof account>>,
  select = true,
  image = false
) {
  const ws = owner.context.workspaceId
  const file = await File.create({
    workspaceId: ws,
    userId: owner.user.id,
    filename: image ? 'image.png' : 'source.txt',
    filetype: image ? '.png' : '.txt',
    objectKey: `workspaces/${ws}/originals/${randomUUID()}.txt`,
    objectUrl: null,
  })
  const revisionId = randomUUID()
  const runId = randomUUID()
  const blockId = randomUUID()
  const chunkId = randomUUID()
  await db.table('file_revisions').insert({
    id: revisionId,
    workspace_id: ws,
    file_id: file.id,
    revision: 1,
    source_hash: 'a'.repeat(64),
    mime: 'text/plain',
  })
  await db.table('processing_runs').insert({
    id: runId,
    workspace_id: ws,
    file_revision_id: revisionId,
    pipeline_version: config.pipelineVersion,
    status: 'ready',
    embedding_model: config.embeddingModel,
    embedding_dimensions: config.embeddingDimensions,
    contextualizer: contextualization.identity,
    stage_timings: {},
    warnings: JSON.stringify([]),
  })
  await db.table('document_blocks').insert({
    id: blockId,
    workspace_id: ws,
    processing_run_id: runId,
    block_type: image ? 'image' : 'paragraph',
    text: 'Private evidence',
    order_index: 0,
    section_path: JSON.stringify([]),
    source_locator: {
      fileKey: file.objectKey,
      fileUrl: 'https://old-public.invalid/file',
      fileName: file.filename,
      mediaType: image ? 'image/png' : 'text/plain',
    },
    extraction_method: 'fixture',
  })
  await db.table('chunks').insert({
    id: chunkId,
    workspace_id: ws,
    file_id: file.id,
    file_revision_id: revisionId,
    run_id: runId,
    chunk_index: 0,
    content: 'Private evidence',
    kind: image ? 'image' : 'text',
    token_count: 2,
  })
  await db
    .table('chunk_blocks')
    .insert({ workspace_id: ws, run_id: runId, chunk_id: chunkId, document_block_id: blockId })
  await db.rawQuery(
    'INSERT INTO chunk_embeddings(workspace_id,chunk_id,model,version,dimensions,embedding,input_hash) VALUES(?,?,?,?,?,?::vector,?)',
    [
      ws,
      chunkId,
      config.embeddingModel,
      config.pipelineVersion,
      config.embeddingDimensions,
      JSON.stringify(
        Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))
      ),
      'a'.repeat(64),
    ]
  )
  if (select) {
    await db
      .table('document_files')
      .insert({ workspace_id: ws, document_id: owner.document.id, files_id: file.id })
    await owner.document.merge({ sourceMode: 'files' }).save()
  }
  return {
    file,
    chunkId,
    blockId,
    pin: {
      fileId: file.id,
      revisionId,
      runId,
      pipelineVersion: config.pipelineVersion,
      embeddingModel: config.embeddingModel,
    },
  }
}
