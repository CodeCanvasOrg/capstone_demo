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
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.store': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaces.update': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaces.select': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'membershipId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'projects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documentVersions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'uploads': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'legacy.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.export': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'legacy.file': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.entry0': { paramsTuple?: []; params?: {} }
    'legacy.entry1': { paramsTuple?: []; params?: {} }
    'legacy.entry2': { paramsTuple?: []; params?: {} }
    'legacy.entry3': { paramsTuple?: []; params?: {} }
    'legacy.entry4': { paramsTuple?: []; params?: {} }
    'shares.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'shares.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'legacy.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.export': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'legacy.file': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.entry0': { paramsTuple?: []; params?: {} }
    'legacy.entry1': { paramsTuple?: []; params?: {} }
    'legacy.entry2': { paramsTuple?: []; params?: {} }
    'legacy.entry3': { paramsTuple?: []; params?: {} }
    'legacy.entry4': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'legacy.document': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.export': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'legacy.file': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'legacy.entry0': { paramsTuple?: []; params?: {} }
    'legacy.entry1': { paramsTuple?: []; params?: {} }
    'legacy.entry2': { paramsTuple?: []; params?: {} }
    'legacy.entry3': { paramsTuple?: []; params?: {} }
    'legacy.entry4': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'workspaces.store': { paramsTuple?: []; params?: {} }
    'workspaces.select': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentVersions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'uploads': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'files.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'shares.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  PATCH: {
    'workspaces.update': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  DELETE: {
    'workspace_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'membershipId': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'shares.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  PUT: {
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}