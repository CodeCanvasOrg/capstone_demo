export const policies = {
  DocumentPolicy: () => import('#policies/document_policy'),
  DocumentSharePolicy: () => import('#policies/document_share_policy'),
  DocumentVersionPolicy: () => import('#policies/document_version_policy'),
}

