import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'invitationAcceptances.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitationAcceptances.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'settings.show': { paramsTuple?: []; params?: {} }
    'settings.profile': { paramsTuple?: []; params?: {} }
    'settings.preferences': { paramsTuple?: []; params?: {} }
    'settings.password': { paramsTuple?: []; params?: {} }
    'settings.credentials.store': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'provider': ParamValue} }
    'settings.credentials.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'provider': ParamValue} }
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.store': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaces.update': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaces.select': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'membershipId': ParamValue} }
    'workspaceInvitations.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaceInvitations.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'invitationId': ParamValue} }
    'workspaceInvitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'invitationId': ParamValue} }
    'documentIssues.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentIssues.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'issueId': ParamValue} }
    'documentPreview.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreview.web': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'templates.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutCatalog.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentLayouts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentLayouts.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentLayouts.applyPreset': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'layoutPresets.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutPresets.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutPresets.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'layoutPresets.duplicate': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'layoutPresets.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'collections.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.arrange': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'projects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documentIssues.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentReviews.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentReviews.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreviews.legacy': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'versionId': ParamValue,'format': ParamValue} }
    'exportPdfs.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.web': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.download': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'taskId': ParamValue} }
    'assets.derived': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue,'revisionId': ParamValue,'assetId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'briefs.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentImages.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentImages.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentImages.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'imageId': ParamValue} }
    'documentImages.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'imageId': ParamValue} }
    'documentCanvases.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.project': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.enable': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.disable': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.draft': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.save': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.preview': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'templateId': ParamValue} }
    'canvasGenerations.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasGenerations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasGenerations.regenerate': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'index': ParamValue} }
    'documentVersions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentRevisions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.generate': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.sources': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'taskId': ParamValue} }
    'assets.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.retry': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'assets.evidence': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
    'assets.evidenceAsset': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
    'uploads': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'fileProjects.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'fileProjects.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue,'projectId': ParamValue} }
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
    'invitationAcceptances.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'settings.show': { paramsTuple?: []; params?: {} }
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentPreview.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreview.web': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'templates.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutCatalog.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentLayouts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'layoutPresets.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documentIssues.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreviews.legacy': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'versionId': ParamValue,'format': ParamValue} }
    'exportPdfs.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.download': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'taskId': ParamValue} }
    'assets.derived': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue,'revisionId': ParamValue,'assetId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documentImages.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentImages.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'imageId': ParamValue} }
    'documentCanvases.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.project': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.preview': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'templateId': ParamValue} }
    'canvasGenerations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'taskId': ParamValue} }
    'assets.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'assets.evidence': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
    'assets.evidenceAsset': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
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
    'invitationAcceptances.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'settings.show': { paramsTuple?: []; params?: {} }
    'workspaces.index': { paramsTuple?: []; params?: {} }
    'workspaces.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspace_members.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentPreview.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreview.web': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'templates.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutCatalog.show': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentLayouts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'layoutPresets.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'projects.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'projects.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documentIssues.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentPreviews.legacy': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'versionId': ParamValue,'format': ParamValue} }
    'exportPdfs.preview': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.download': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'taskId': ParamValue} }
    'assets.derived': { paramsTuple: [ParamValue,ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue,'revisionId': ParamValue,'assetId': ParamValue} }
    'documents.index': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.create': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documents.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documentImages.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentImages.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'imageId': ParamValue} }
    'documentCanvases.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.project': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.index': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasTemplates.preview': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'templateId': ParamValue} }
    'canvasGenerations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.show': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'taskId': ParamValue} }
    'assets.download': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'assets.evidence': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
    'assets.evidenceAsset': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'chunkId': ParamValue} }
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
    'invitationAcceptances.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'workspaces.store': { paramsTuple?: []; params?: {} }
    'workspaces.select': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaceInvitations.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'workspaceInvitations.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'invitationId': ParamValue} }
    'documentIssues.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentLayouts.applyPreset': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'layoutPresets.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'layoutPresets.duplicate': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'collections.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'collections.arrange': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'collections.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'projects.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentReviews.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentReviews.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'exportPdfs.web': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'briefs.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentImages.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.enable': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.disable': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentCanvases.save': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasGenerations.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'canvasGenerations.regenerate': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'index': ParamValue} }
    'documentVersions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentRevisions.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.generate': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'files.retry': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'uploads': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'fileProjects.store': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'files.store': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'shares.store': { paramsTuple: [ParamValue]; params: {'documentId': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  PATCH: {
    'settings.profile': { paramsTuple?: []; params?: {} }
    'settings.preferences': { paramsTuple?: []; params?: {} }
    'workspaces.update': { paramsTuple: [ParamValue]; params: {'workspaceId': ParamValue} }
    'documentIssues.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'issueId': ParamValue} }
    'layoutPresets.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'collections.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'collectionId': ParamValue} }
    'projects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'projectId': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documentImages.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue,'imageId': ParamValue} }
    'files.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  PUT: {
    'settings.password': { paramsTuple?: []; params?: {} }
    'settings.credentials.store': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'provider': ParamValue} }
    'documentLayouts.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'documentCanvases.draft': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'documentTasks.sources': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'documentId': ParamValue} }
    'files.update': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'shares.update': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
  DELETE: {
    'settings.credentials.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'kind': ParamValue,'provider': ParamValue} }
    'workspace_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'membershipId': ParamValue} }
    'workspaceInvitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'invitationId': ParamValue} }
    'layoutPresets.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'presetId': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'fileProjects.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue,'projectId': ParamValue} }
    'files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'workspaceId': ParamValue,'id': ParamValue} }
    'shares.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'documentId': ParamValue,'id': ParamValue} }
    'legacy.documents.collection': { paramsTuple?: []; params?: {} }
    'legacy.documents.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'legacy.files.collection': { paramsTuple?: []; params?: {} }
    'legacy.files.mutation': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}