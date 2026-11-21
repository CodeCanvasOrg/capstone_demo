/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  invitationAcceptances: {
    show: typeof routes['invitationAcceptances.show']
    store: typeof routes['invitationAcceptances.store']
  }
  home: typeof routes['home']
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  settings: {
    show: typeof routes['settings.show']
    profile: typeof routes['settings.profile']
    preferences: typeof routes['settings.preferences']
    password: typeof routes['settings.password']
    credentials: {
      store: typeof routes['settings.credentials.store']
      destroy: typeof routes['settings.credentials.destroy']
    }
  }
  workspaces: {
    index: typeof routes['workspaces.index']
    store: typeof routes['workspaces.store']
    show: typeof routes['workspaces.show']
    update: typeof routes['workspaces.update']
    select: typeof routes['workspaces.select']
  }
  workspaceMembers: {
    index: typeof routes['workspace_members.index']
    destroy: typeof routes['workspace_members.destroy']
  }
  workspaceInvitations: {
    store: typeof routes['workspaceInvitations.store']
    resend: typeof routes['workspaceInvitations.resend']
    destroy: typeof routes['workspaceInvitations.destroy']
  }
  documentIssues: {
    store: typeof routes['documentIssues.store']
    update: typeof routes['documentIssues.update']
    index: typeof routes['documentIssues.index']
  }
  documentPreview: {
    show: typeof routes['documentPreview.show']
  }
  templates: {
    index: typeof routes['templates.index']
  }
  layoutCatalog: {
    show: typeof routes['layoutCatalog.show']
  }
  documentLayouts: {
    show: typeof routes['documentLayouts.show']
    update: typeof routes['documentLayouts.update']
    applyPreset: typeof routes['documentLayouts.applyPreset']
  }
  layoutPresets: {
    index: typeof routes['layoutPresets.index']
    store: typeof routes['layoutPresets.store']
    update: typeof routes['layoutPresets.update']
    duplicate: typeof routes['layoutPresets.duplicate']
    destroy: typeof routes['layoutPresets.destroy']
  }
  collections: {
    index: typeof routes['collections.index']
    store: typeof routes['collections.store']
    show: typeof routes['collections.show']
    update: typeof routes['collections.update']
    arrange: typeof routes['collections.arrange']
    approve: typeof routes['collections.approve']
    preview: typeof routes['collections.preview']
    download: typeof routes['collections.download']
  }
  projects: {
    index: typeof routes['projects.index']
    store: typeof routes['projects.store']
    show: typeof routes['projects.show']
    update: typeof routes['projects.update']
  }
  documentReviews: {
    store: typeof routes['documentReviews.store']
    approve: typeof routes['documentReviews.approve']
  }
  documentPreviews: {
    legacy: typeof routes['documentPreviews.legacy']
  }
  exportPdfs: {
    preview: typeof routes['exportPdfs.preview']
    store: typeof routes['exportPdfs.store']
    download: typeof routes['exportPdfs.download']
  }
  assets: {
    derived: typeof routes['assets.derived']
    download: typeof routes['assets.download']
    evidence: typeof routes['assets.evidence']
    evidenceAsset: typeof routes['assets.evidenceAsset']
  }
  documents: {
    index: typeof routes['documents.index']
    create: typeof routes['documents.create']
    store: typeof routes['documents.store']
    edit: typeof routes['documents.edit']
    update: typeof routes['documents.update']
    destroy: typeof routes['documents.destroy']
  }
  briefs: {
    store: typeof routes['briefs.store']
  }
  documentImages: {
    store: typeof routes['documentImages.store']
    show: typeof routes['documentImages.show']
  }
  documentVersions: {
    store: typeof routes['documentVersions.store']
  }
  documentRevisions: {
    store: typeof routes['documentRevisions.store']
  }
  documentTasks: {
    generate: typeof routes['documentTasks.generate']
    sources: typeof routes['documentTasks.sources']
    show: typeof routes['documentTasks.show']
  }
  files: {
    retry: typeof routes['files.retry']
    index: typeof routes['files.index']
    create: typeof routes['files.create']
    store: typeof routes['files.store']
    edit: typeof routes['files.edit']
    update: typeof routes['files.update']
    destroy: typeof routes['files.destroy']
  }
  uploads: typeof routes['uploads']
  fileProjects: {
    store: typeof routes['fileProjects.store']
    destroy: typeof routes['fileProjects.destroy']
  }
  legacy: {
    document: typeof routes['legacy.document']
    export: typeof routes['legacy.export']
    file: typeof routes['legacy.file']
    entry0: typeof routes['legacy.entry0']
    entry1: typeof routes['legacy.entry1']
    entry2: typeof routes['legacy.entry2']
    entry3: typeof routes['legacy.entry3']
    entry4: typeof routes['legacy.entry4']
    documents: {
      collection: typeof routes['legacy.documents.collection']
      mutation: typeof routes['legacy.documents.mutation']
    }
    files: {
      collection: typeof routes['legacy.files.collection']
      mutation: typeof routes['legacy.files.mutation']
    }
  }
  shares: {
    store: typeof routes['shares.store']
    update: typeof routes['shares.update']
    destroy: typeof routes['shares.destroy']
  }
}
