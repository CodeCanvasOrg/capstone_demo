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
  shares: {
    store: typeof routes['shares.store']
    update: typeof routes['shares.update']
    destroy: typeof routes['shares.destroy']
  }
  exportPdfs: typeof routes['export_pdfs']
  documentShares: {
    index: typeof routes['document_shares.index']
  }
  uploads: typeof routes['uploads']
  files: {
    index: typeof routes['files.index']
    create: typeof routes['files.create']
    store: typeof routes['files.store']
    edit: typeof routes['files.edit']
    update: typeof routes['files.update']
    destroy: typeof routes['files.destroy']
  }
}
