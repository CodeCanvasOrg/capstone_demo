/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').renderInertia('home', {}).as('home')

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

    // Documents
    router.resource('documents', () => import('#controllers/documents_controller')).except(['show'])
    router
      .group(() => {
        // Creating document versions for version control
        router
          .post('/versions', [() => import('#controllers/document_versions_controller'), 'handle'])
          .as('documentVersions.store')
        // Sharing documents
        router
          .resource('/shares', controllers.DocumentShares)
          .except(['index', 'show', 'edit', 'create'])
        // Exporting Documents
        router.get('/export/pdf', [controllers.ExportPdfs, 'handle'])
      })
      .prefix('documents/:documentId')
    router.get('documents/shares', [
      () => import('#controllers/document_shares_controller'),
      'index',
    ])
    router.post('files/uploads', [controllers.Uploads, 'handle'])
  })
  .use(middleware.auth())
