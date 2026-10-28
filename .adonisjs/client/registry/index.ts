/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'invitationAcceptances.show': {
    methods: ["GET","HEAD"],
    pattern: '/invitations/:token',
    tokens: [{"old":"/invitations/:token","type":0,"val":"invitations","end":""},{"old":"/invitations/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['invitationAcceptances.show']['types'],
  },
  'invitationAcceptances.store': {
    methods: ["POST"],
    pattern: '/invitations/:token/accept',
    tokens: [{"old":"/invitations/:token/accept","type":0,"val":"invitations","end":""},{"old":"/invitations/:token/accept","type":1,"val":"token","end":""},{"old":"/invitations/:token/accept","type":0,"val":"accept","end":""}],
    types: placeholder as Registry['invitationAcceptances.store']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'workspaces.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces',
    tokens: [{"old":"/workspaces","type":0,"val":"workspaces","end":""}],
    types: placeholder as Registry['workspaces.index']['types'],
  },
  'workspaces.store': {
    methods: ["POST"],
    pattern: '/workspaces',
    tokens: [{"old":"/workspaces","type":0,"val":"workspaces","end":""}],
    types: placeholder as Registry['workspaces.store']['types'],
  },
  'workspaces.show': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId',
    tokens: [{"old":"/workspaces/:workspaceId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId","type":1,"val":"workspaceId","end":""}],
    types: placeholder as Registry['workspaces.show']['types'],
  },
  'workspaces.update': {
    methods: ["PATCH"],
    pattern: '/workspaces/:workspaceId',
    tokens: [{"old":"/workspaces/:workspaceId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId","type":1,"val":"workspaceId","end":""}],
    types: placeholder as Registry['workspaces.update']['types'],
  },
  'workspaces.select': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/selection',
    tokens: [{"old":"/workspaces/:workspaceId/selection","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/selection","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/selection","type":0,"val":"selection","end":""}],
    types: placeholder as Registry['workspaces.select']['types'],
  },
  'workspace_members.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/members',
    tokens: [{"old":"/workspaces/:workspaceId/members","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/members","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/members","type":0,"val":"members","end":""}],
    types: placeholder as Registry['workspace_members.index']['types'],
  },
  'workspace_members.destroy': {
    methods: ["DELETE"],
    pattern: '/workspaces/:workspaceId/members/:membershipId',
    tokens: [{"old":"/workspaces/:workspaceId/members/:membershipId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/members/:membershipId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/members/:membershipId","type":0,"val":"members","end":""},{"old":"/workspaces/:workspaceId/members/:membershipId","type":1,"val":"membershipId","end":""}],
    types: placeholder as Registry['workspace_members.destroy']['types'],
  },
  'workspaceInvitations.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/invitations',
    tokens: [{"old":"/workspaces/:workspaceId/invitations","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/invitations","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/invitations","type":0,"val":"invitations","end":""}],
    types: placeholder as Registry['workspaceInvitations.store']['types'],
  },
  'workspaceInvitations.resend': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/invitations/:invitationId/resend',
    tokens: [{"old":"/workspaces/:workspaceId/invitations/:invitationId/resend","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId/resend","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId/resend","type":0,"val":"invitations","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId/resend","type":1,"val":"invitationId","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId/resend","type":0,"val":"resend","end":""}],
    types: placeholder as Registry['workspaceInvitations.resend']['types'],
  },
  'workspaceInvitations.destroy': {
    methods: ["DELETE"],
    pattern: '/workspaces/:workspaceId/invitations/:invitationId',
    tokens: [{"old":"/workspaces/:workspaceId/invitations/:invitationId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId","type":0,"val":"invitations","end":""},{"old":"/workspaces/:workspaceId/invitations/:invitationId","type":1,"val":"invitationId","end":""}],
    types: placeholder as Registry['workspaceInvitations.destroy']['types'],
  },
  'documentIssues.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/issues',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"issues","end":""}],
    types: placeholder as Registry['documentIssues.store']['types'],
  },
  'documentIssues.update': {
    methods: ["PATCH"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/issues/:issueId',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":0,"val":"issues","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues/:issueId","type":1,"val":"issueId","end":""}],
    types: placeholder as Registry['documentIssues.update']['types'],
  },
  'documentPreview.show': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/preview',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/preview","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview","type":0,"val":"preview","end":""}],
    types: placeholder as Registry['documentPreview.show']['types'],
  },
  'templates.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/templates',
    tokens: [{"old":"/workspaces/:workspaceId/templates","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/templates","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/templates","type":0,"val":"templates","end":""}],
    types: placeholder as Registry['templates.index']['types'],
  },
  'projects.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/projects',
    tokens: [{"old":"/workspaces/:workspaceId/projects","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/projects","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/projects","type":0,"val":"projects","end":""}],
    types: placeholder as Registry['projects.index']['types'],
  },
  'projects.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/projects',
    tokens: [{"old":"/workspaces/:workspaceId/projects","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/projects","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/projects","type":0,"val":"projects","end":""}],
    types: placeholder as Registry['projects.store']['types'],
  },
  'projects.show': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/projects/:projectId',
    tokens: [{"old":"/workspaces/:workspaceId/projects/:projectId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":0,"val":"projects","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":1,"val":"projectId","end":""}],
    types: placeholder as Registry['projects.show']['types'],
  },
  'projects.update': {
    methods: ["PATCH"],
    pattern: '/workspaces/:workspaceId/projects/:projectId',
    tokens: [{"old":"/workspaces/:workspaceId/projects/:projectId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":0,"val":"projects","end":""},{"old":"/workspaces/:workspaceId/projects/:projectId","type":1,"val":"projectId","end":""}],
    types: placeholder as Registry['projects.update']['types'],
  },
  'documentIssues.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/issues',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/issues","type":0,"val":"issues","end":""}],
    types: placeholder as Registry['documentIssues.index']['types'],
  },
  'documentReviews.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/reviews',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/reviews","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/reviews","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/reviews","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/reviews","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/reviews","type":0,"val":"reviews","end":""}],
    types: placeholder as Registry['documentReviews.store']['types'],
  },
  'documentReviews.approve': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/approvals',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/approvals","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/approvals","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/approvals","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/approvals","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/approvals","type":0,"val":"approvals","end":""}],
    types: placeholder as Registry['documentReviews.approve']['types'],
  },
  'documentPreviews.legacy': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":0,"val":"versions","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":1,"val":"versionId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":0,"val":"preview","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions/:versionId/preview/:format","type":1,"val":"format","end":""}],
    types: placeholder as Registry['documentPreviews.legacy']['types'],
  },
  'exportPdfs.preview': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/preview/pdf',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":0,"val":"preview","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/preview/pdf","type":0,"val":"pdf","end":""}],
    types: placeholder as Registry['exportPdfs.preview']['types'],
  },
  'exportPdfs.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/exports/pdf',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":0,"val":"exports","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/pdf","type":0,"val":"pdf","end":""}],
    types: placeholder as Registry['exportPdfs.store']['types'],
  },
  'exportPdfs.download': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":0,"val":"exports","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":1,"val":"taskId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/exports/:taskId/download","type":0,"val":"download","end":""}],
    types: placeholder as Registry['exportPdfs.download']['types'],
  },
  'assets.derived': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":1,"val":"id","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":0,"val":"revisions","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":1,"val":"revisionId","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":0,"val":"assets","end":""},{"old":"/workspaces/:workspaceId/files/:id/revisions/:revisionId/assets/:assetId","type":1,"val":"assetId","end":""}],
    types: placeholder as Registry['assets.derived']['types'],
  },
  'documents.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents',
    tokens: [{"old":"/workspaces/:workspaceId/documents","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['documents.index']['types'],
  },
  'documents.create': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/create',
    tokens: [{"old":"/workspaces/:workspaceId/documents/create","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/create","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/create","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['documents.create']['types'],
  },
  'documents.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents',
    tokens: [{"old":"/workspaces/:workspaceId/documents","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['documents.store']['types'],
  },
  'documents.edit': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:id/edit',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:id/edit","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:id/edit","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:id/edit","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:id/edit","type":1,"val":"id","end":""},{"old":"/workspaces/:workspaceId/documents/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['documents.edit']['types'],
  },
  'documents.update': {
    methods: ["PUT","PATCH"],
    pattern: '/workspaces/:workspaceId/documents/:id',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:id","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['documents.update']['types'],
  },
  'documents.destroy': {
    methods: ["DELETE"],
    pattern: '/workspaces/:workspaceId/documents/:id',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:id","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['documents.destroy']['types'],
  },
  'documentImages.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/images',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/images","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images","type":0,"val":"images","end":""}],
    types: placeholder as Registry['documentImages.store']['types'],
  },
  'documentImages.show': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/images/:imageId',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":0,"val":"images","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/images/:imageId","type":1,"val":"imageId","end":""}],
    types: placeholder as Registry['documentImages.show']['types'],
  },
  'documentVersions.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/versions',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/versions","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/versions","type":0,"val":"versions","end":""}],
    types: placeholder as Registry['documentVersions.store']['types'],
  },
  'documentTasks.generate': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/generation',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/generation","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/generation","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/generation","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/generation","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/generation","type":0,"val":"generation","end":""}],
    types: placeholder as Registry['documentTasks.generate']['types'],
  },
  'documentTasks.sources': {
    methods: ["PUT"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/sources',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/sources","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/sources","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/sources","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/sources","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/sources","type":0,"val":"sources","end":""}],
    types: placeholder as Registry['documentTasks.sources']['types'],
  },
  'documentTasks.show': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/tasks/:taskId',
    tokens: [{"old":"/workspaces/:workspaceId/tasks/:taskId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/tasks/:taskId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/tasks/:taskId","type":0,"val":"tasks","end":""},{"old":"/workspaces/:workspaceId/tasks/:taskId","type":1,"val":"taskId","end":""}],
    types: placeholder as Registry['documentTasks.show']['types'],
  },
  'assets.download': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/files/:id/download',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id/download","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id/download","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id/download","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id/download","type":1,"val":"id","end":""},{"old":"/workspaces/:workspaceId/files/:id/download","type":0,"val":"download","end":""}],
    types: placeholder as Registry['assets.download']['types'],
  },
  'files.retry': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/files/:id/retry',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id/retry","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id/retry","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id/retry","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id/retry","type":1,"val":"id","end":""},{"old":"/workspaces/:workspaceId/files/:id/retry","type":0,"val":"retry","end":""}],
    types: placeholder as Registry['files.retry']['types'],
  },
  'assets.evidence': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":0,"val":"evidence","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId","type":1,"val":"chunkId","end":""}],
    types: placeholder as Registry['assets.evidence']['types'],
  },
  'assets.evidenceAsset': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset',
    tokens: [{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":0,"val":"documents","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":1,"val":"documentId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":0,"val":"evidence","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":1,"val":"chunkId","end":""},{"old":"/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId/asset","type":0,"val":"asset","end":""}],
    types: placeholder as Registry['assets.evidenceAsset']['types'],
  },
  'uploads': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/files/uploads',
    tokens: [{"old":"/workspaces/:workspaceId/files/uploads","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/uploads","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/uploads","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/uploads","type":0,"val":"uploads","end":""}],
    types: placeholder as Registry['uploads']['types'],
  },
  'files.index': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/files',
    tokens: [{"old":"/workspaces/:workspaceId/files","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files","type":0,"val":"files","end":""}],
    types: placeholder as Registry['files.index']['types'],
  },
  'files.create': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/files/create',
    tokens: [{"old":"/workspaces/:workspaceId/files/create","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/create","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/create","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['files.create']['types'],
  },
  'files.store': {
    methods: ["POST"],
    pattern: '/workspaces/:workspaceId/files',
    tokens: [{"old":"/workspaces/:workspaceId/files","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files","type":0,"val":"files","end":""}],
    types: placeholder as Registry['files.store']['types'],
  },
  'files.edit': {
    methods: ["GET","HEAD"],
    pattern: '/workspaces/:workspaceId/files/:id/edit',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id/edit","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id/edit","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id/edit","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id/edit","type":1,"val":"id","end":""},{"old":"/workspaces/:workspaceId/files/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['files.edit']['types'],
  },
  'files.update': {
    methods: ["PUT","PATCH"],
    pattern: '/workspaces/:workspaceId/files/:id',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['files.update']['types'],
  },
  'files.destroy': {
    methods: ["DELETE"],
    pattern: '/workspaces/:workspaceId/files/:id',
    tokens: [{"old":"/workspaces/:workspaceId/files/:id","type":0,"val":"workspaces","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":1,"val":"workspaceId","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":0,"val":"files","end":""},{"old":"/workspaces/:workspaceId/files/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['files.destroy']['types'],
  },
  'legacy.document': {
    methods: ["GET","HEAD"],
    pattern: '/documents/:id/edit',
    tokens: [{"old":"/documents/:id/edit","type":0,"val":"documents","end":""},{"old":"/documents/:id/edit","type":1,"val":"id","end":""},{"old":"/documents/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['legacy.document']['types'],
  },
  'legacy.export': {
    methods: ["GET","HEAD"],
    pattern: '/documents/:documentId/export/pdf',
    tokens: [{"old":"/documents/:documentId/export/pdf","type":0,"val":"documents","end":""},{"old":"/documents/:documentId/export/pdf","type":1,"val":"documentId","end":""},{"old":"/documents/:documentId/export/pdf","type":0,"val":"export","end":""},{"old":"/documents/:documentId/export/pdf","type":0,"val":"pdf","end":""}],
    types: placeholder as Registry['legacy.export']['types'],
  },
  'legacy.file': {
    methods: ["GET","HEAD"],
    pattern: '/files/:id/edit',
    tokens: [{"old":"/files/:id/edit","type":0,"val":"files","end":""},{"old":"/files/:id/edit","type":1,"val":"id","end":""},{"old":"/files/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['legacy.file']['types'],
  },
  'legacy.entry0': {
    methods: ["GET","HEAD"],
    pattern: '/documents',
    tokens: [{"old":"/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['legacy.entry0']['types'],
  },
  'legacy.entry1': {
    methods: ["GET","HEAD"],
    pattern: '/documents/create',
    tokens: [{"old":"/documents/create","type":0,"val":"documents","end":""},{"old":"/documents/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['legacy.entry1']['types'],
  },
  'legacy.entry2': {
    methods: ["GET","HEAD"],
    pattern: '/documents/shares',
    tokens: [{"old":"/documents/shares","type":0,"val":"documents","end":""},{"old":"/documents/shares","type":0,"val":"shares","end":""}],
    types: placeholder as Registry['legacy.entry2']['types'],
  },
  'legacy.entry3': {
    methods: ["GET","HEAD"],
    pattern: '/files',
    tokens: [{"old":"/files","type":0,"val":"files","end":""}],
    types: placeholder as Registry['legacy.entry3']['types'],
  },
  'legacy.entry4': {
    methods: ["GET","HEAD"],
    pattern: '/files/create',
    tokens: [{"old":"/files/create","type":0,"val":"files","end":""},{"old":"/files/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['legacy.entry4']['types'],
  },
  'shares.store': {
    methods: ["POST"],
    pattern: '/documents/:documentId/shares',
    tokens: [{"old":"/documents/:documentId/shares","type":0,"val":"documents","end":""},{"old":"/documents/:documentId/shares","type":1,"val":"documentId","end":""},{"old":"/documents/:documentId/shares","type":0,"val":"shares","end":""}],
    types: placeholder as Registry['shares.store']['types'],
  },
  'shares.update': {
    methods: ["PUT"],
    pattern: '/documents/:documentId/shares/:id',
    tokens: [{"old":"/documents/:documentId/shares/:id","type":0,"val":"documents","end":""},{"old":"/documents/:documentId/shares/:id","type":1,"val":"documentId","end":""},{"old":"/documents/:documentId/shares/:id","type":0,"val":"shares","end":""},{"old":"/documents/:documentId/shares/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['shares.update']['types'],
  },
  'shares.destroy': {
    methods: ["DELETE"],
    pattern: '/documents/:documentId/shares/:id',
    tokens: [{"old":"/documents/:documentId/shares/:id","type":0,"val":"documents","end":""},{"old":"/documents/:documentId/shares/:id","type":1,"val":"documentId","end":""},{"old":"/documents/:documentId/shares/:id","type":0,"val":"shares","end":""},{"old":"/documents/:documentId/shares/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['shares.destroy']['types'],
  },
  'legacy.documents.collection': {
    methods: ["POST","PUT","PATCH","DELETE"],
    pattern: '/documents',
    tokens: [{"old":"/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['legacy.documents.collection']['types'],
  },
  'legacy.documents.mutation': {
    methods: ["POST","PUT","PATCH","DELETE"],
    pattern: '/documents/*',
    tokens: [{"old":"/documents/*","type":0,"val":"documents","end":""},{"old":"/documents/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['legacy.documents.mutation']['types'],
  },
  'legacy.files.collection': {
    methods: ["POST","PUT","PATCH","DELETE"],
    pattern: '/files',
    tokens: [{"old":"/files","type":0,"val":"files","end":""}],
    types: placeholder as Registry['legacy.files.collection']['types'],
  },
  'legacy.files.mutation': {
    methods: ["POST","PUT","PATCH","DELETE"],
    pattern: '/files/*',
    tokens: [{"old":"/files/*","type":0,"val":"files","end":""},{"old":"/files/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['legacy.files.mutation']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
