import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router
  .get('/invitations/:token', [controllers.InvitationAcceptances, 'show'])
  .as('invitationAcceptances.show')
router
  .post('/invitations/:token/accept', [controllers.InvitationAcceptances, 'store'])
  .use(middleware.auth())
  .as('invitationAcceptances.store')
router.get('/', [controllers.Entry, 'handle']).as('home')
router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())
router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
    router.get('/workspaces', [controllers.Workspaces, 'index']).as('workspaces.index')
    router.post('/workspaces', [controllers.Workspaces, 'store']).as('workspaces.store')
    router
      .group(() => {
        router.get('/', [controllers.Workspaces, 'show']).as('workspaces.show')
        router.patch('/', [controllers.Workspaces, 'update']).as('workspaces.update')
        router.post('/selection', [controllers.Workspaces, 'select']).as('workspaces.select')
        router
          .get('/members', [controllers.WorkspaceMembers, 'index'])
          .as('workspace_members.index')
        router
          .delete('/members/:membershipId', [controllers.WorkspaceMembers, 'destroy'])
          .as('workspace_members.destroy')
        router
          .post('/invitations', [controllers.WorkspaceInvitations, 'store'])
          .as('workspaceInvitations.store')
        router
          .post('/invitations/:invitationId/resend', [controllers.WorkspaceInvitations, 'resend'])
          .as('workspaceInvitations.resend')
        router
          .delete('/invitations/:invitationId', [controllers.WorkspaceInvitations, 'destroy'])
          .as('workspaceInvitations.destroy')
        router
          .post('/documents/:documentId/issues', [controllers.DocumentIssues, 'store'])
          .as('documentIssues.store')
        router
          .patch('/documents/:documentId/issues/:issueId', [controllers.DocumentIssues, 'update'])
          .as('documentIssues.update')
        router.get('/projects', [controllers.Projects, 'index']).as('projects.index')
        router.post('/projects', [controllers.Projects, 'store']).as('projects.store')
        router.get('/projects/:projectId', [controllers.Projects, 'show']).as('projects.show')
        router.patch('/projects/:projectId', [controllers.Projects, 'update']).as('projects.update')
        router
          .get('/documents/:documentId/issues', [controllers.DocumentIssues, 'index'])
          .as('documentIssues.index')
        router
          .post('/documents/:documentId/reviews', [controllers.DocumentReviews, 'store'])
          .as('documentReviews.store')
        router
          .post('/documents/:documentId/approvals', [controllers.DocumentReviews, 'approve'])
          .as('documentReviews.approve')
        router
          .get('/documents/:documentId/preview/pdf', [controllers.ExportPdfs, 'preview'])
          .as('exportPdfs.preview')
        router
          .post('/documents/:documentId/exports/pdf', [controllers.ExportPdfs, 'handle'])
          .as('exportPdfs.store')
        router
          .get('/documents/:documentId/exports/:taskId/download', [
            controllers.ExportPdfs,
            'download',
          ])
          .as('exportPdfs.download')
        router
          .get('/files/:id/revisions/:revisionId/assets/:assetId', [controllers.Assets, 'derived'])
          .as('assets.derived')
        router.resource('documents', controllers.Documents).except(['show'])
        router
          .post('/documents/:documentId/versions', [controllers.DocumentVersions, 'handle'])
          .as('documentVersions.store')
        router
          .post('/documents/:documentId/generation', [controllers.DocumentTasks, 'generate'])
          .as('documentTasks.generate')
        router
          .put('/documents/:documentId/sources', [controllers.DocumentTasks, 'sources'])
          .as('documentTasks.sources')
        router.get('/tasks/:taskId', [controllers.DocumentTasks, 'show']).as('documentTasks.show')
        router.get('/files/:id/download', [controllers.Assets, 'download']).as('assets.download')
        router.post('/files/:id/retry', [controllers.DocumentTasks, 'retry']).as('files.retry')
        router
          .get('/documents/:documentId/evidence/:chunkId', [controllers.Assets, 'evidence'])
          .as('assets.evidence')
        router
          .get('/documents/:documentId/evidence/:chunkId/asset', [controllers.Assets, 'asset'])
          .as('assets.evidenceAsset')
        router.post('files/uploads', [controllers.Uploads, 'handle'])
        router.resource('files', controllers.Files).except(['show']).as('files')
      })
      .prefix('/workspaces/:workspaceId')
      .use(middleware.resolveWorkspace())

    // GET compatibility is authorized against the resource's actual workspace.
    router
      .get('/documents/:id/edit', [controllers.LegacyResources, 'document'])
      .as('legacy.document')
    router
      .get('/documents/:documentId/export/pdf', [controllers.LegacyResources, 'document'])
      .as('legacy.export')
    router.get('/files/:id/edit', [controllers.LegacyResources, 'file']).as('legacy.file')
    router.get('/documents', [controllers.Entry, 'handle']).as('legacy.entry0')
    router.get('/documents/create', [controllers.Entry, 'handle']).as('legacy.entry1')
    router.get('/documents/shares', [controllers.Entry, 'handle']).as('legacy.entry2')
    router.get('/files', [controllers.Entry, 'handle']).as('legacy.entry3')
    router.get('/files/create', [controllers.Entry, 'handle']).as('legacy.entry4')
    router
      .post('/documents/:documentId/shares', [controllers.LegacyResources, 'retired'])
      .as('shares.store')
    router
      .put('/documents/:documentId/shares/:id', [controllers.LegacyResources, 'retired'])
      .as('shares.update')
    router
      .delete('/documents/:documentId/shares/:id', [controllers.LegacyResources, 'retired'])
      .as('shares.destroy')
    for (const prefix of ['documents', 'files']) {
      router
        .route(
          `/${prefix}`,
          ['POST', 'PUT', 'PATCH', 'DELETE'],
          [controllers.LegacyResources, 'retired']
        )
        .as(`legacy.${prefix}.collection`)
      router
        .route(
          `/${prefix}/*`,
          ['POST', 'PUT', 'PATCH', 'DELETE'],
          [controllers.LegacyResources, 'retired']
        )
        .as(`legacy.${prefix}.mutation`)
    }
  })
  .use(middleware.auth())
