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
    'errors/workspace_unavailable': ExtractProps<(typeof import('../../inertia/pages/errors/workspace_unavailable.tsx'))['default']>
    'files/create': ExtractProps<(typeof import('../../inertia/pages/files/create.tsx'))['default']>
    'files/edit': ExtractProps<(typeof import('../../inertia/pages/files/edit.tsx'))['default']>
    'files/index': ExtractProps<(typeof import('../../inertia/pages/files/index.tsx'))['default']>
    'invitations/show': ExtractProps<(typeof import('../../inertia/pages/invitations/show.tsx'))['default']>
    'projects/index': ExtractProps<(typeof import('../../inertia/pages/projects/index.tsx'))['default']>
    'projects/show': ExtractProps<(typeof import('../../inertia/pages/projects/show.tsx'))['default']>
    'workspaces/home': ExtractProps<(typeof import('../../inertia/pages/workspaces/home.tsx'))['default']>
    'workspaces/index': ExtractProps<(typeof import('../../inertia/pages/workspaces/index.tsx'))['default']>
    'workspaces/members': ExtractProps<(typeof import('../../inertia/pages/workspaces/members.tsx'))['default']>
  }
}
