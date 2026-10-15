import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import ReadinessService from '#services/documents/readiness_service'
import ContentService from '#services/documents/content_service'
import EvidenceService from '#services/documents/evidence_service'
import ExportPdfService from '#services/exports/pdf_service'
import AccessService, {
  conflict,
  uuid,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import TaskService, { type TaskLease } from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
export default class DocumentExportService {
  async request(
    context: WorkspaceAccessContext,
    documentId: string,
    input: { approvalId: string; mutationId: string }
  ) {
    const task = await db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const state = await new ReadinessService().inspect(doc, trx)
      if (!state.approved || doc.activeApprovalId !== input.approvalId)
        throw conflict('Approve the exact current version before final export')
      return new TaskService().create(
        context,
        {
          kind: 'render',
          documentId,
          mutationId: input.mutationId,
          payload: {
            approvalId: input.approvalId,
            versionId: doc.currentVersionId!,
            pins: state.pins,
            brandVersion: 'humblebee-1',
          },
        },
        trx
      )
    })
    await new TaskDispatchService().dispatch()
    return task
  }
  async render(lease: TaskLease) {
    const tasks = new TaskService()
    await tasks.check(lease)
    const doc = await new AccessService().document(lease.context, lease.task.documentId!)
    const state = await new ReadinessService().inspect(doc)
    if (
      !state.approved ||
      doc.activeApprovalId !== lease.task.payload.approvalId ||
      doc.currentVersionId !== lease.task.payload.versionId
    )
      throw conflict('Approval changed before rendering')
    const version = await DocumentVersion.query()
      .where({
        id: doc.currentVersionId!,
        workspaceId: lease.context.workspaceId,
        documentId: doc.id,
      })
      .firstOrFail()
    const content = await this.content(lease.context, doc.id, version.content, () =>
      tasks.check(lease)
    )
    await tasks.check(lease)
    const buffer = await ExportPdfService.generate({ content } as DocumentVersion)
    const key = `workspaces/${lease.context.workspaceId}/exports/${lease.task.id}.pdf`
    try {
      await tasks.finish(lease, async (trx) => {
        const current = await Document.query({ client: trx })
          .where({ id: doc.id, workspaceId: lease.context.workspaceId })
          .forUpdate()
          .firstOrFail()
        const currentState = await new ReadinessService().inspect(current, trx)
        if (
          !currentState.approved ||
          current.activeApprovalId !== lease.task.payload.approvalId ||
          current.currentVersionId !== lease.task.payload.versionId
        )
          throw conflict('Approval changed during rendering')
        await drive
          .use()
          .put(key, buffer, { contentType: 'application/pdf', visibility: 'private' })
        return {
          artifactKey: key,
          approvalId: current.activeApprovalId,
          versionId: current.currentVersionId,
        }
      })
    } catch (error) {
      await drive
        .use()
        .delete(key)
        .catch(() => {})
      throw error
    }
  }
  async download(context: WorkspaceAccessContext, documentId: string, taskId: string) {
    if (!uuid(taskId)) throw missingResource()
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const task = await WorkspaceTask.query({ client: trx })
        .where({
          id: taskId,
          workspaceId: context.workspaceId,
          documentId,
          kind: 'render',
          status: 'succeeded',
        })
        .firstOrFail()
      const state = await new ReadinessService().inspect(doc, trx)
      if (
        !state.approved ||
        doc.activeApprovalId !== task.result.approvalId ||
        doc.currentVersionId !== task.result.versionId
      )
        throw conflict('This final export is no longer approved')
      if (typeof task.result.artifactKey !== 'string') throw missingResource()
      return {
        stream: await drive.use().getStream(task.result.artifactKey),
        title: doc.title ?? 'Case study',
      }
    })
  }
  async preview(context: WorkspaceAccessContext, documentId: string) {
    const access = new AccessService()
    const doc = await access.document(context, documentId)
    if (!doc.currentVersionId) throw conflict('Save a version before previewing')
    const version = await DocumentVersion.query()
      .where({ id: doc.currentVersionId, documentId, workspaceId: context.workspaceId })
      .firstOrFail()
    const check = () => new EvidenceService().check(context)
    const content = await this.content(context, documentId, version.content, check)
    await check()
    const buffer = await ExportPdfService.generate({ content } as DocumentVersion, {
      preview: true,
    })
    await check()
    const current = await access.document(context, documentId)
    if (current.currentVersionId !== version.id)
      throw conflict('The saved version changed during preview')
    return buffer
  }
  private async content(
    context: WorkspaceAccessContext,
    documentId: string,
    value: unknown,
    guard: () => Promise<void>
  ) {
    const service = new EvidenceService()
    const content = await service.hydrate(
      context,
      documentId,
      new ContentService().normalize(value)
    )
    const embed = async (node: (typeof content.content)[number]): Promise<void> => {
      if (node.type === 'image' && typeof node.attrs?.sourceChunkId === 'string') {
        await guard()
        const asset = await service.asset(context, documentId, node.attrs.sourceChunkId)
        if (!/^image\/(png|jpeg|gif|webp)$/.test(asset.mime))
          throw conflict('Unsupported export image')
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of asset.stream) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += bytes.length
          if (size > 20000000) throw conflict('Export image is too large')
          chunks.push(bytes)
        }
        node.attrs.src = `data:${asset.mime};base64,${Buffer.concat(chunks).toString('base64')}`
      }
      for (const child of node.content ?? []) await embed(child)
    }
    for (const node of content.content) await embed(node)
    return content
  }
}
