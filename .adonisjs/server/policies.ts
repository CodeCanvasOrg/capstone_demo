export const policies = {
  DocumentPolicy: () => import('#policies/document_policy'),
  DocumentVersionPolicy: () => import('#policies/document_version_policy'),
  FilePolicy: () => import('#policies/file_policy'),
  ProjectPolicy: () => import('#policies/project_policy'),
  WorkspacePolicy: () => import('#policies/workspace_policy'),
}

