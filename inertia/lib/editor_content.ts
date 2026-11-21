import type { Editor, JSONContent } from '@tiptap/react'
import { toFlat, toPaged } from '../../shared/brochure/paged.ts'

/** A brochure is edited as pages; everything stored and sent to the server is flat. */
export const isPaged = (editor: Editor) => !!editor.schema.nodes.page
export const storedContent = (editor: Editor): JSONContent =>
  isPaged(editor) ? toFlat(editor.getJSON()) : editor.getJSON()
export const editorContent = (editor: Editor, content: JSONContent): JSONContent =>
  isPaged(editor) ? toPaged(content) : content
