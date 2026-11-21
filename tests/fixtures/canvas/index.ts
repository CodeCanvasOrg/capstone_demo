import { documentFromPages, type PageContent } from '../../../shared/brochure/content.ts'
import { DESIGN_IDS, type DesignId } from '../../../shared/brochure/designs.ts'
import { CANVAS_SCHEMA_VERSION, type CanvasDocument } from '../../../shared/canvas/model.ts'
import { samples } from '../brochure/pages.ts'
import { maxPage } from '../brochure/max.ts'

export const CHUNK = 'chunk-1'
export const IMAGE = '7b0c1f4e-1d2a-4c3b-9a8e-2f6d5c4b3a21'

/** The stored flat document for a list of pages, as generation writes it. */
export const storedDoc = (pages: PageContent[]) =>
  documentFromPages(pages, { allowedChunkIds: new Set([CHUNK]) }).document

/** Every design once, in catalog order: one page each. */
export const allDesigns = () => ({
  designs: [...DESIGN_IDS] as DesignId[],
  doc: storedDoc(DESIGN_IDS.map((design) => samples[design])),
})

/** Every design filled to its limits. */
export const maxDesigns = () => ({
  designs: [...DESIGN_IDS] as DesignId[],
  doc: storedDoc(DESIGN_IDS.map((design) => maxPage(design))),
})

const text = (value: string) => ({ type: 'paragraph', content: [{ type: 'text', text: value }] })

export const minimal = (): CanvasDocument => ({
  schemaVersion: CANVAS_SCHEMA_VERSION,
  sheets: [
    {
      id: 's0',
      background: 'white',
      frames: [
        {
          id: 's0-f0',
          kind: 'text',
          geo: { x: 200, y: 300, w: 800, h: 400 },
          z: 1,
          order: 0,
          style: { font: 'lg', color: 'primary' },
          doc: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Cited ' },
                { type: 'sourceCitation', attrs: { sourceChunkId: CHUNK } },
              ],
            },
          ],
        },
        {
          id: 's0-f1',
          kind: 'figure',
          geo: { x: 1200, y: 300, w: 600, h: 300 },
          z: 2,
          order: 1,
          style: {},
          value: '83%',
          label: 'of executives',
        },
        {
          id: 's0-f2',
          kind: 'shape',
          geo: { x: 0, y: 0, w: 2100, h: 200 },
          z: 0,
          order: 2,
          style: { fill: '#112233' },
          shape: 'rect',
        },
      ],
    },
    {
      id: 's1',
      background: 'primary',
      frames: [
        {
          id: 's1-f0',
          kind: 'image',
          geo: { x: 200, y: 200, w: 1000, h: 800 },
          z: 0,
          order: 0,
          style: {},
          imageId: IMAGE,
          alt: 'A scanner',
          fit: 'cover',
        },
        {
          id: 's1-f1',
          kind: 'text',
          geo: { x: 200, y: 1100, w: 1700, h: 300 },
          z: 1,
          order: 1,
          style: {},
          doc: [text('Second page')],
        },
      ],
    },
  ],
})

/** Inputs a hostile client could send; each must be refused or neutralised. */
export const malicious = {
  scriptKind: () => {
    const c = minimal() as any
    c.sheets[0].frames.push({
      ...c.sheets[0].frames[2],
      id: 'x1',
      kind: 'script',
      content: 'alert(1)',
    })
    return c
  },
  htmlInText: () => {
    const c = minimal() as any
    c.sheets[0].frames[0].doc = [{ type: 'html', content: '<img src=x onerror=alert(1)>' }]
    return c
  },
  styleInjection: () => {
    const c = minimal() as any
    c.sheets[0].frames[2].style.fill = 'red;background:url(javascript:alert(1))'
    return c
  },
  foreignImage: () => minimal(),
  eventAttribute: () => {
    const c = minimal() as any
    c.sheets[0].frames[0].onerror = 'alert(1)'
    c.sheets[0].frames[0].attributes = { onclick: 'alert(1)' }
    return c
  },
  badId: () => {
    const c = minimal() as any
    c.sheets[0].frames[0].id = '"><script>'
    return c
  },
  outsideSheet: () => {
    const c = minimal() as any
    c.sheets[0].frames[0].geo = { x: 1500, y: 300, w: 800, h: 400 }
    return c
  },
  linkScheme: () => {
    const c = minimal() as any
    c.sheets[0].frames[0].doc = [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'x',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
    ]
    return c
  },
}
