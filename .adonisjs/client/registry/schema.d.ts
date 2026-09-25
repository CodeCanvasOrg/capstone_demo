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
      response: unknown
      errorResponse: unknown
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
  'documents.index': {
    methods: ["GET","HEAD"]
    pattern: '/documents'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['index']>>>
    }
  }
  'documents.create': {
    methods: ["GET","HEAD"]
    pattern: '/documents/create'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['create']>>>
    }
  }
  'documents.store': {
    methods: ["POST"]
    pattern: '/documents'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/documents').documentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/documents').documentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.edit': {
    methods: ["GET","HEAD"]
    pattern: '/documents/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['edit']>>>
    }
  }
  'documents.update': {
    methods: ["PUT","PATCH"]
    pattern: '/documents/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/documents').documentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/documents').documentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.destroy': {
    methods: ["DELETE"]
    pattern: '/documents/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['destroy']>>>
    }
  }
  'documentVersions.store': {
    methods: ["POST"]
    pattern: '/documents/:documentId/versions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_version').documentVersionValidator)>>
      paramsTuple: [ParamValue]
      params: { documentId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_version').documentVersionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_versions_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_versions_controller').default['handle']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'shares.store': {
    methods: ["POST"]
    pattern: '/documents/:documentId/shares'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_share').documentShareValidator)>>
      paramsTuple: [ParamValue]
      params: { documentId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_share').documentShareValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'shares.update': {
    methods: ["PUT","PATCH"]
    pattern: '/documents/:documentId/shares/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document_share').documentShareRoleValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { documentId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document_share').documentShareRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['destroy']>>>
    }
  }
  'export_pdfs': {
    methods: ["GET","HEAD"]
    pattern: '/documents/:documentId/export/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { documentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/export_pdfs_controller').default['handle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/export_pdfs_controller').default['handle']>>>
    }
  }
  'document_shares.index': {
    methods: ["GET","HEAD"]
    pattern: '/documents/shares'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/document_shares_controller').default['index']>>>
    }
  }
}
