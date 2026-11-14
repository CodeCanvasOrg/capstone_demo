import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(...react, {
  rules: {
    // Pure shared helpers contain no backend imports and are covered by Node-based tests.
    '@adonisjs/no-backend-import-in-frontend': [
      'error',
      {
        allowed: [
          '../../../shared/writing_reveal.ts',
          '../../../shared/publication/tiptap_extension.ts',
          '../../../shared/editor/schema.ts',
          '../../../shared/publication/content.ts',
          '../../../shared/project_information.ts',
          '../../shared/ui_feedback.ts',
          '../../../shared/templates/outlines',
          '../../../shared/layout/brand.ts',
          '../../../shared/templates/instructions.ts',
          '../../../shared/templates/outlines.ts',
          '../../../shared/layout/pages.ts',
          '../../../shared/layout/formats.ts',
        ],
      },
    ],
  },
})
