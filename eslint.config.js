import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(...react, {
  rules: {
    // This pure ProseMirror helper is shared with the Node-based regression test.
    '@adonisjs/no-backend-import-in-frontend': [
      'error',
      { allowed: ['../../../shared/writing_reveal.ts'] },
    ],
  },
})
