import { SHEET_TYPE, frameType } from './grapes.ts'
import type { FrameKind } from './model.ts'

/**
 * The editing rules of our component types, as a GrapesJS plugin. Model only,
 * no DOM, so it also runs in a headless editor (tests, server checks). The
 * browser adds views on top (inertia/components/canvas/grapes/plugins).
 *
 * Typed loosely on purpose: shared code must not import grapesjs.
 */
export const FRAME_KINDS: FrameKind[] = ['text', 'figure', 'image', 'shape', 'art']

type Editor = {
  Components: { addType: (id: string, definition: Record<string, unknown>) => void }
}

const isType = (type: string) => (el: { dataset?: Record<string, string> }) =>
  el?.dataset?.cvType === type ? { type } : false

export function canvasTypes(editor: Editor) {
  editor.Components.addType(SHEET_TYPE, {
    isComponent: isType(SHEET_TYPE),
    model: {
      defaults: {
        cv: null,
        tagName: 'section',
        attributes: { 'data-cv-type': SHEET_TYPE },
        draggable: false,
        // Only frames can be dropped on a sheet.
        droppable: (_target: unknown, source?: { get?: (k: string) => unknown }) =>
          String(source?.get?.('type') ?? '').startsWith('cv-') &&
          source?.get?.('type') !== SHEET_TYPE,
        removable: false,
        copyable: false,
        resizable: false,
        stylable: [],
        layerable: true,
      },
    },
  })

  for (const kind of FRAME_KINDS) {
    const type = frameType(kind)
    editor.Components.addType(type, {
      isComponent: isType(type),
      model: {
        defaults: {
          cv: null,
          tagName: 'div',
          attributes: { 'data-cv-type': type },
          // Frames live on sheets and are placed like in a design tool.
          draggable: `[data-cv-type="${SHEET_TYPE}"]`,
          droppable: false,
          dmode: 'absolute',
          resizable: { ratioDefault: kind === 'image' },
          copyable: true,
          removable: true,
          editable: kind === 'text',
          // Looks are edited through our inspector, which writes `cv.style`.
          stylable: ['left', 'top', 'width', 'height', 'z-index'],
        },
      },
    })
  }
}
