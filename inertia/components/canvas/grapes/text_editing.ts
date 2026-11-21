import { Editor as TiptapEditor } from '@tiptap/core'
import type { Component } from 'grapesjs'
import { documentExtensions } from '../../../../shared/editor/schema.ts'
import type { Frame } from '../../../../shared/canvas/model.ts'

/**
 * Editing a text frame in place: Tiptap is mounted in the frame's element inside
 * the canvas while it is being edited, with the same schema as the text editor,
 * so citations, links and lists behave the same. Keys stay inside the frame so
 * GrapesJS shortcuts (delete, arrows) do not act on the frame meanwhile.
 */
export type TextEditing = {
  component: Component
  tiptap: TiptapEditor
  /** Ends editing and returns the frame's blocks. */
  finish: () => unknown[]
}

export function startTextEditing(
  el: HTMLElement,
  component: Component,
  frame: Frame,
  { onUpdate, onExit }: { onUpdate: () => void; onExit: () => void }
): TextEditing {
  const doc = frame.kind === 'text' ? frame.doc : []
  el.innerHTML = ''
  el.classList.add('cv-editing')
  const tiptap = new TiptapEditor({
    element: el,
    extensions: documentExtensions(),
    content: { type: 'doc', content: doc.length ? doc : [{ type: 'paragraph' }] },
    autofocus: 'end',
    onUpdate,
  })
  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onExit()
    }
    event.stopPropagation()
  }
  el.addEventListener('keydown', keys)
  return {
    component,
    tiptap,
    finish() {
      const content = (tiptap.getJSON().content ?? []) as unknown[]
      el.removeEventListener('keydown', keys)
      el.classList.remove('cv-editing')
      tiptap.destroy()
      // Page breaks belong between sheets: a pasted one is dropped, never stored in a frame.
      return content.filter((block) => (block as { type?: string }).type !== 'horizontalRule')
    },
  }
}
