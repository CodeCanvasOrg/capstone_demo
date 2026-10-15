/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
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
  projects: {
    index: typeof routes['projects.index']
    store: typeof routes['projects.store']
    show: typeof routes['projects.show']
    update: typeof routes['projects.update']
  }
  documents: {
    index: typeof routes['documents.index']
    create: typeof routes['documents.create']
    store: typeof routes['documents.store']
    edit: typeof routes['documents.edit']
    update: typeof routes['documents.update']
    destroy: typeof routes['documents.destroy']
  }
  documentVersions: {
    store: typeof routes['documentVersions.store']
  }
  documentTasks: {
    generate: typeof routes['documentTasks.generate']
    sources: typeof routes['documentTasks.sources']
    show: typeof routes['documentTasks.show']
  }
  assets: {
    download: typeof routes['assets.download']
    evidence: typeof routes['assets.evidence']
    evidenceAsset: typeof routes['assets.evidenceAsset']
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
