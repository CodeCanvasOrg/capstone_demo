import OutlineTemplateService from '#services/documents/outline_template_service'
import LegacyTemplateService from '#services/documents/legacy_template_service'
import { evidenceNodeCount } from '#services/documents/chunk_metadata_service'
import DocumentWorkflowTransformer from '#transformers/document_workflow_transformer'
import File from '#models/file'
import Project from '#models/project'
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
import CreationService from '#services/documents/creation_service'
import AccessService from '#services/workspaces/access_service'
import SourceScopeService from '#services/files/source_scope_service'
import type { HttpContext } from '@adonisjs/core/http'
import CanvasService, { canvasEnabled } from '#services/canvas/canvas_service'
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
      documents: DocumentTransformer.transform(page.all(), workspaceAccess!.actorId),
      projects: ProjectTransformer.transform(
        await workspace!.related('projects').query().orderBy('name')
      ),
      pagination: page.getMeta(),
      filters: { q, status: status ?? '', project: projectId ?? '' },
    })
  }
  async create({ workspace, workspaceAccess, bouncer, inertia, request }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const files = await workspace!
      .related('files')
      .query()
      .preload('projects')
      .preload('revisions', (rev) =>
        rev
          .orderBy('revision', 'desc')
          .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
      )
    const projects = await workspace!.related('projects').query().orderBy('name')
    const projectId = request.input('projectId')
    if (projectId) await new AccessService().project(workspaceAccess!, projectId)
    return inertia.render('documents/create', {
      templates: await new OutlineTemplateService().list(workspaceAccess!),
      initialProjectId: projectId ?? null,
      files: FileTransformer.transform(files, workspaceAccess!.actorId),
      projects: ProjectTransformer.transform(projects),
    })
  }
  async store({ workspaceAccess, request, bouncer, response }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const { files, ...input } = await request.validateUsing(documentValidator)
    const document = await new CreationService().document(
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
    await new LegacyTemplateService().history(document.documentVersions)
    let unavailableEvidence = false
    for (const version of document.documentVersions) {
      const original = new ContentService().normalize(version.content, { repair: true })
      version.content = await new EvidenceService().hydrate(workspaceAccess!, document.id, original)
      if (evidenceNodeCount(original) > evidenceNodeCount(version.content))
        unavailableEvidence = true
    }
    const issues = await DocumentIssue.query()
      .where({ workspaceId: workspaceAccess!.workspaceId, documentId: document.id })
      .orderBy('createdAt', 'desc')
    const state = await new ReadinessService().inspect(document)
    const approvalHistory = await DocumentApproval.query()
      .where({ workspaceId: workspaceAccess!.workspaceId, documentId: document.id })
      .orderBy('createdAt', 'desc')
      .limit(20)
    const availableFiles = await workspaceFiles(workspaceAccess!.workspaceId, document.projectId)
    return inertia.render('documents/edit', {
      unavailableEvidence,
      canvas: {
        enabled: canvasEnabled(),
        mode: canvasEnabled()
          ? await new CanvasService().mode(workspaceAccess!.workspaceId, document.id)
          : 'flow',
      },
      projects: ProjectTransformer.transform(
        await Project.query().where('workspaceId', workspaceAccess!.workspaceId).orderBy('name')
      ),
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
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
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

async function workspaceFiles(workspaceId: string, projectId: string | null) {
  return new SourceScopeService()
    .eligible(File.query().where('workspaceId', workspaceId), projectId)
    .preload('projects')
    .preload('revisions', (rev) =>
      rev
        .orderBy('revision', 'desc')
        .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
    )
    .orderBy('filename')
}
