import DocumentWorkflowTransformer from '#transformers/document_workflow_transformer'
import File from '#models/file'
import ReadinessService from '#services/documents/readiness_service'
import DocumentApproval from '#models/document_approval'
import DocumentIssue from '#models/document_issue'
import DocumentIssueTransformer from '#transformers/document_issue_transformer'
import EvidenceService from '#services/documents/evidence_service'
import ContentService from '#services/documents/content_service'
import Document from '#models/document'
import DocumentPolicy from '#policies/document_policy'
import DocumentTransformer from '#transformers/document_transformer'
import FileTransformer from '#transformers/file_transformer'
import ProjectTransformer from '#transformers/project_transformer'
import { documentValidator, documentUpdateValidator } from '#validators/documents'
import DocumentService from '#services/documents/document_service'
import AccessService from '#services/workspaces/access_service'
import type { HttpContext } from '@adonisjs/core/http'
export default class DocumentsController {
  async index({ workspace, workspaceAccess, bouncer, request, inertia }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const q = String(request.input('q', '')).slice(0, 200)
    const query = workspace!
      .related('documents')
      .query()
      .preload('user')
      .orderBy('updatedAt', 'desc')
    if (q) query.whereILike('title', `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
    const status = request.input('status')
    if (['draft', 'edited', 'in_review', 'approved'].includes(status)) query.where('status', status)
    const projectId = request.input('project')
    if (projectId === 'ungrouped') query.whereNull('projectId')
    else if (projectId) {
      await new AccessService().project(workspaceAccess!, projectId)
      query.where('projectId', projectId)
    }
    const page = await query.paginate(
      Math.min(100000, Math.max(1, Math.floor(Number(request.input('page', 1)) || 1))),
      20
    )
    return inertia.render('documents/index', {
      documents: DocumentTransformer.transform(page.all()),
      pagination: page.getMeta(),
      filters: { q, status: status ?? '', project: projectId ?? '' },
    })
  }
  async create({ workspace, workspaceAccess, bouncer, inertia }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const files = await workspace!
      .related('files')
      .query()
      .preload('revisions', (rev) =>
        rev
          .orderBy('revision', 'desc')
          .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
      )
    const projects = await workspace!.related('projects').query().orderBy('name')
    return inertia.render('documents/create', {
      files: FileTransformer.transform(files, workspaceAccess!.actorId),
      projects: ProjectTransformer.transform(projects),
    })
  }
  async store({ workspaceAccess, request, bouncer, response }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const { files, ...input } = await request.validateUsing(documentValidator)
    const document = await new DocumentService().create(
      workspaceAccess!,
      input,
      files?.map((file) => file.id) ?? []
    )
    return response
      .redirect()
      .toRoute('documents.edit', { workspaceId: document.workspaceId!, id: document.id })
  }
  async edit({ workspaceAccess, params, bouncer, inertia }: HttpContext) {
    const found = await new AccessService().document(workspaceAccess!, params.id)
    await bouncer.with(DocumentPolicy).authorize('edit', found)
    const document = await Document.query()
      .where({ id: found.id, workspaceId: workspaceAccess!.workspaceId })
      .preload('user')
      .preload('documentVersions', (version) => version.preload('user').orderBy('version', 'desc'))
      .preload('files', (file) =>
        file.preload('revisions', (rev) =>
          rev
            .orderBy('revision', 'desc')
            .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
        )
      )
      .firstOrFail()
    for (const version of document.documentVersions)
      version.content = await new EvidenceService().hydrate(
        workspaceAccess!,
        document.id,
        new ContentService().normalize(version.content)
      )
    const issues = await DocumentIssue.query()
      .where({ workspaceId: workspaceAccess!.workspaceId, documentId: document.id })
      .orderBy('createdAt', 'desc')
    const state = await new ReadinessService().inspect(document)
    const approvalHistory = await DocumentApproval.query()
      .where({ workspaceId: workspaceAccess!.workspaceId, documentId: document.id })
      .orderBy('createdAt', 'desc')
      .limit(20)
    const availableFiles = await workspaceFiles(workspaceAccess!.workspaceId)
    return inertia.render('documents/edit', {
      workflow: DocumentWorkflowTransformer.transform({ state, approvalHistory }),
      availableFiles: FileTransformer.transform(availableFiles, workspaceAccess!.actorId),
      issues: DocumentIssueTransformer.transform(issues),
      document: DocumentTransformer.transform(document, workspaceAccess!.actorId),
    })
  }
  async update({ workspaceAccess, params, request, bouncer, response }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.id)
    await bouncer.with(DocumentPolicy).authorize('update', document)
    await new DocumentService().update(
      workspaceAccess!,
      document.id,
      await request.validateUsing(documentUpdateValidator)
    )
    return response
      .redirect()
      .toRoute('documents.edit', { workspaceId: workspaceAccess!.workspaceId, id: document.id })
  }
  async destroy({ workspaceAccess, params, bouncer, response }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.id)
    await bouncer.with(DocumentPolicy).authorize('delete', document)
    await new DocumentService().destroy(workspaceAccess!, document.id)
    return response
      .redirect()
      .toRoute('documents.index', { workspaceId: workspaceAccess!.workspaceId })
  }
}

async function workspaceFiles(workspaceId: string) {
  return File.query()
    .where('workspaceId', workspaceId)
    .preload('revisions', (rev) =>
      rev
        .orderBy('revision', 'desc')
        .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
    )
    .orderBy('filename')
}
