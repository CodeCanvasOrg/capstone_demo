/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'new_account.create': {
    methods: ["GET","HEAD"]
    pattern: '/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
    }
  }
  'new_account.store': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'workspaces.index': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['index']>>>
    }
  }
  'workspaces.store': {
    methods: ["POST"]
    pattern: '/workspaces'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/workspace').createWorkspaceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/workspace').createWorkspaceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workspaces.show': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['show']>>>
    }
  }
  'workspaces.update': {
    methods: ["PATCH"]
    pattern: '/workspaces/:workspaceId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/workspace').createWorkspaceValidator)>>
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/workspace').createWorkspaceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workspaces.select': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/selection'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['select']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspaces_controller').default['select']>>>
    }
  }
  'workspace_members.index': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/members'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspace_members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspace_members_controller').default['index']>>>
    }
  }
  'workspace_members.destroy': {
    methods: ["DELETE"]
    pattern: '/workspaces/:workspaceId/members/:membershipId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; membershipId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workspace_members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workspace_members_controller').default['destroy']>>>
    }
  }
  'projects.index': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/projects'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['index']>>>
    }
  }
  'projects.store': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/projects'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/project').createProjectValidator)>>
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/project').createProjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'projects.show': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/projects/:projectId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; projectId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['show']>>>
    }
  }
  'projects.update': {
    methods: ["PATCH"]
    pattern: '/workspaces/:workspaceId/projects/:projectId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/project').createProjectValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; projectId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/project').createProjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/projects_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.index': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/documents'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['index']>>>
    }
  }
  'documents.create': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/documents/create'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['create']>>>
    }
  }
  'documents.store': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/documents'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/documents').documentValidator)>>
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/documents').documentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.edit': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/documents/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['edit']>>>
    }
  }
  'documents.update': {
    methods: ["PUT","PATCH"]
    pattern: '/workspaces/:workspaceId/documents/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/documents').documentUpdateValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/documents').documentUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.destroy': {
    methods: ["DELETE"]
    pattern: '/workspaces/:workspaceId/documents/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['destroy']>>>
    }
  }
  'documentVersions.store': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/documents/:documentId/versions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_version').documentVersionValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; documentId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_version').documentVersionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_versions_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_versions_controller').default['handle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documentTasks.generate': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/documents/:documentId/generate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_task').generateValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; documentId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_task').generateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documentTasks.sources': {
    methods: ["PUT"]
    pattern: '/workspaces/:workspaceId/documents/:documentId/sources'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_task').sourceSelectionValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; documentId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_task').sourceSelectionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['sources']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['sources']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documentTasks.show': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/tasks/:taskId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; taskId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['show']>>>
    }
  }
  'assets.download': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/files/:id/download'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['download']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['download']>>>
    }
  }
  'files.retry': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/files/:id/retry'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_task').generateValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_task').generateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['retry']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_tasks_controller').default['retry']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'assets.evidence': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { workspaceId: ParamValue; documentId: ParamValue; chunkId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['evidence']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['evidence']>>>
    }
  }
  'assets.evidenceAsset': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { workspaceId: ParamValue; documentId: ParamValue; chunkId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['asset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assets_controller').default['asset']>>>
    }
  }
  'uploads': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/files/uploads'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/upload').fileValidator)>>
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/upload').fileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/uploads_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/uploads_controller').default['handle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'files.index': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/files'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['index']>>>
    }
  }
  'files.create': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/files/create'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['create']>>>
    }
  }
  'files.store': {
    methods: ["POST"]
    pattern: '/workspaces/:workspaceId/files'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { workspaceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['store']>>>
    }
  }
  'files.edit': {
    methods: ["GET","HEAD"]
    pattern: '/workspaces/:workspaceId/files/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['edit']>>>
    }
  }
  'files.update': {
    methods: ["PUT","PATCH"]
    pattern: '/workspaces/:workspaceId/files/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/file').fileValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/file').fileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'files.destroy': {
    methods: ["DELETE"]
    pattern: '/workspaces/:workspaceId/files/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { workspaceId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/files_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/files_controller').default['destroy']>>>
    }
  }
  'legacy.document': {
    methods: ["GET","HEAD"]
    pattern: '/documents/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['document']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['document']>>>
    }
  }
  'legacy.export': {
    methods: ["GET","HEAD"]
    pattern: '/documents/:documentId/export/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { documentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['document']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['document']>>>
    }
  }
  'legacy.file': {
    methods: ["GET","HEAD"]
    pattern: '/files/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['file']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['file']>>>
    }
  }
  'legacy.entry0': {
    methods: ["GET","HEAD"]
    pattern: '/documents'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'legacy.entry1': {
    methods: ["GET","HEAD"]
    pattern: '/documents/create'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'legacy.entry2': {
    methods: ["GET","HEAD"]
    pattern: '/documents/shares'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'legacy.entry3': {
    methods: ["GET","HEAD"]
    pattern: '/files'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'legacy.entry4': {
    methods: ["GET","HEAD"]
    pattern: '/files/create'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entry_controller').default['handle']>>>
    }
  }
  'shares.store': {
    methods: ["POST"]
    pattern: '/documents/:documentId/shares'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { documentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'shares.update': {
    methods: ["PUT"]
    pattern: '/documents/:documentId/shares/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { documentId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'shares.destroy': {
    methods: ["DELETE"]
    pattern: '/documents/:documentId/shares/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { documentId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'legacy.documents.collection': {
    methods: ["POST","PUT","PATCH","DELETE"]
    pattern: '/documents'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'legacy.documents.mutation': {
    methods: ["POST","PUT","PATCH","DELETE"]
    pattern: '/documents/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'legacy.files.collection': {
    methods: ["POST","PUT","PATCH","DELETE"]
    pattern: '/files'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
  'legacy.files.mutation': {
    methods: ["POST","PUT","PATCH","DELETE"]
    pattern: '/files/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/legacy_resources_controller').default['retired']>>>
    }
  }
}
