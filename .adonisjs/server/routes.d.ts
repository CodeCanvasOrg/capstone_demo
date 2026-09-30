import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.store': { paramsTuple?: []; params?: {} }
    'documents.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documentVersions.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'shares.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'shares.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'export_pdfs': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'uploads': { paramsTuple?: []; params?: {} }
    'files.index': { paramsTuple?: []; params?: {} }
    'files.create': { paramsTuple?: []; params?: {} }
    'files.store': { paramsTuple?: []; params?: {} }
    'files.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'files.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'export_pdfs': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'files.index': { paramsTuple?: []; params?: {} }
    'files.create': { paramsTuple?: []; params?: {} }
    'files.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'export_pdfs': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'files.index': { paramsTuple?: []; params?: {} }
    'files.create': { paramsTuple?: []; params?: {} }
    'files.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'documents.store': { paramsTuple?: []; params?: {} }
    'documentVersions.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'shares.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'uploads': { paramsTuple?: []; params?: {} }
    'files.store': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'documents.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'shares.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'files.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}