import { fingerprint } from '#services/workspaces/task_service'
import RichTextService from '#services/rich_text_service'
import ProjectInformationService from '#services/documents/project_information_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import WorkflowService from '#services/documents/workflow_service'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import File from '#models/file'
import Project from '#models/project'
import AccessService, {
  conflict,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const INFORMATION_FIELDS = [
  'overview',
  'problemStatement',
  'workCompleted',
  'technicalApproach',
  'tools',
  'challenges',
  'results',
] as const
export type ProjectInformation = Record<(typeof INFORMATION_FIELDS)[number], string>
export const emptyInformation = (): ProjectInformation =>
  Object.fromEntries(INFORMATION_FIELDS.map((key) => [key, ''])) as ProjectInformation
export type DocumentInput = {
  title: string
  description?: string | null
  descriptionContent?: TipTapDocument | null
  projectId?: string | null
  dueDate?: string | null
  projectInformation?: Partial<ProjectInformation>
  projectInformationContent?: TipTapDocument | null
  sourceMode?: 'files' | 'input_only'
}

export default class DocumentService {
  async create(
    context: WorkspaceAccessContext,
    input: DocumentInput,
    fileIds: string[],
    client?: TransactionClientContract
  ) {
    if (input.descriptionContent)
      input = { ...input, ...new RichTextService().description(input.descriptionContent) }
    if (input.projectInformationContent !== null && input.projectInformationContent !== undefined)
      input = {
        ...input,
        ...new ProjectInformationService().normalize(input.projectInformationContent),
      }
    if (
      input.dueDate &&
      (!DateTime.fromISO(input.dueDate).isValid ||
        DateTime.fromISO(input.dueDate).toISODate() !== input.dueDate)
    )
      throw new Exception('Invalid calendar deadline', { status: 422 })
    const create = async (trx: TransactionClientContract) => {
      await new AccessService().lock(context, trx)
      if (
        input.projectId &&
        !(await Project.query({ client: trx })
          .where({ id: input.projectId, workspaceId: context.workspaceId })
          .first())
      )
        throw missingResource()
      const ids = [...new Set(fileIds)]
      const files = await File.query({ client: trx })
        .where('workspaceId', context.workspaceId)
        .whereIn('id', ids)
        .forUpdate()
      if (files.length !== ids.length) throw missingResource()
      if (input.sourceMode === 'input_only' && ids.length)
        throw conflict('Input-only documents cannot select source files')
      const document = await Document.create(
        {
          workspaceId: context.workspaceId,
          userId: context.actorId,
          title: input.title,
          description: input.description ?? null,
          descriptionContent: input.descriptionContent ?? null,
          projectInformationContent: input.projectInformationContent ?? null,
          projectId: input.projectId ?? null,
          dueDate: input.dueDate ? DateTime.fromISO(input.dueDate) : null,
          projectInformation: Object.fromEntries(
            INFORMATION_FIELDS.map((key) => [key, input.projectInformation?.[key] ?? ''])
          ),
          sourceMode: input.sourceMode ?? 'files',
          status: 'draft',
          generationStatus: 'ready',
        },
        { client: trx }
      )
      if (ids.length)
        await trx.table('document_files').insert(
          ids.map((filesId) => ({
            workspace_id: context.workspaceId,
            document_id: document.id,
            files_id: filesId,
          }))
        )
      return document
    }
    return client ? create(client) : db.transaction(create)
  }
  async update(
    context: WorkspaceAccessContext,
    id: string,
    input: DocumentInput & { metadataRevision: number }
  ) {
    if (input.descriptionContent)
      input = { ...input, ...new RichTextService().description(input.descriptionContent) }
    if (input.projectInformationContent !== null && input.projectInformationContent !== undefined)
      input = {
        ...input,
        ...new ProjectInformationService().normalize(input.projectInformationContent),
      }
    if (
      input.dueDate &&
      (!DateTime.fromISO(input.dueDate).isValid ||
        DateTime.fromISO(input.dueDate).toISODate() !== input.dueDate)
    )
      throw new Exception('Invalid calendar deadline', { status: 422 })
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (document.metadataRevision !== input.metadataRevision)
        throw conflict('This document changed. Keep your input and reload its latest metadata.')
      if (
        input.projectId &&
        !(await Project.query({ client: trx })
          .where({ id: input.projectId, workspaceId: context.workspaceId })
          .first())
      )
        throw missingResource()
      const informationChanged =
        input.projectInformation !== undefined &&
        INFORMATION_FIELDS.some(
          (key) =>
            (input.projectInformation?.[key] ?? '') !== (document.projectInformation?.[key] ?? '')
        )
      const informationContent =
        input.projectInformationContent === undefined && !informationChanged
          ? document.projectInformationContent
          : (input.projectInformationContent ?? null)
      const changesContent =
        input.title !== document.title ||
        (input.description ?? null) !== document.description ||
        (input.descriptionContent !== undefined &&
          fingerprint(input.descriptionContent) !== fingerprint(document.descriptionContent)) ||
        informationChanged ||
        fingerprint(informationContent) !== fingerprint(document.projectInformationContent)
      if (changesContent)
        await new WorkflowService().invalidate(
          document,
          context.actorId,
          'Project information changed',
          trx
        )
      if (input.title !== document.title && document.templateSetup?.generateTitle) {
        const templateSetup = { ...document.templateSetup }
        delete templateSetup.generateTitle
        document.templateSetup = templateSetup
      }
      document.merge({
        title: input.title,
        description: input.description ?? null,
        descriptionContent:
          input.descriptionContent === undefined &&
          (input.description ?? null) === document.description
            ? document.descriptionContent
            : (input.descriptionContent ?? null),
        projectId: input.projectId ?? null,
        dueDate: input.dueDate ? DateTime.fromISO(input.dueDate) : null,
        projectInformation: input.projectInformation
          ? Object.fromEntries(
              INFORMATION_FIELDS.map((key) => [key, input.projectInformation?.[key] ?? ''])
            )
          : document.projectInformation,
        projectInformationContent: informationContent,
        metadataRevision: document.metadataRevision + 1,
      })
      if (changesContent && ['in_review', 'approved'].includes(document.status ?? ''))
        document.status = 'edited'
      await document.save()
      return document
    })
  }
  async destroy(context: WorkspaceAccessContext, id: string) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (document.userId !== context.actorId)
        throw new Exception('Only the document owner can delete it', { status: 403 })
      await document.delete()
    })
  }
}
