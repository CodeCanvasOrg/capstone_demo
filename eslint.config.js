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
          '../../../shared/layout/portfolio.ts',
          '../../../shared/brochure/designs.ts',
          '../../../shared/brochure/content.ts',
          '../../../shared/brochure/paged.ts',
          '../../shared/brochure/paged.ts',
          '../../../shared/layout/figure.ts',
          '../../../shared/settings.ts',
          '../../../shared/canvas/model.ts',
          '../../../shared/canvas/geometry.ts',
          '../../../shared/canvas/grapes.ts',
          '../../../shared/canvas/ops.ts',
          '../../../../shared/canvas/model.ts',
          '../../../../shared/canvas/geometry.ts',
          '../../../../shared/canvas/grapes.ts',
          '../../../../shared/canvas/grapes_types.ts',
          '../../../../shared/canvas/css.ts',
          '../../../../shared/editor/schema.ts',
          '../../../../shared/layout/brand.ts',
        ],
      },
    ],
  },
})
