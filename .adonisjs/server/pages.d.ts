import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/signup': ExtractProps<(typeof import('../../inertia/pages/auth/signup.tsx'))['default']>
    'document_shares/index': ExtractProps<(typeof import('../../inertia/pages/document_shares/index.tsx'))['default']>
    'documents/create': ExtractProps<(typeof import('../../inertia/pages/documents/create.tsx'))['default']>
    'documents/edit': ExtractProps<(typeof import('../../inertia/pages/documents/edit.tsx'))['default']>
    'documents/index': ExtractProps<(typeof import('../../inertia/pages/documents/index.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'files/create': ExtractProps<(typeof import('../../inertia/pages/files/create.tsx'))['default']>
    'files/edit': ExtractProps<(typeof import('../../inertia/pages/files/edit.tsx'))['default']>
    'files/index': ExtractProps<(typeof import('../../inertia/pages/files/index.tsx'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.tsx'))['default']>
  }
}
