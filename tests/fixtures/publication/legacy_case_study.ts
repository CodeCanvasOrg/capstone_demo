import type { PublicationDocument } from '../../../shared/publication/content.ts'

const CHUNK = 'f3a1c0de-0000-4000-8000-000000000001'
const IMAGE = 'f3a1c0de-0000-4000-8000-000000000002'

/** Frozen pre-OUT-02 case study: no IDs, no metadata, hydrated evidence attrs. */
export const legacyCaseStudy: PublicationDocument = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Faster onboarding' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Summary of the work 🚀.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Challenge' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Onboarding took ' },
        { type: 'text', text: 'weeks', marks: [{ type: 'bold' }] },
        { type: 'hardBreak' },
        { type: 'text', text: 'up to 30% faster is the target.' },
        { type: 'sourceCitation', attrs: { sourceChunkId: CHUNK, chunkText: 'Hydrated text' } },
      ],
    },
    {
      type: 'image',
      attrs: { sourceChunkId: IMAGE, src: '/workspaces/x/files/y', alt: 'Flow', align: 'center' },
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Solution' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
        },
      ],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'TODO check this with the client' }] },
  ],
}
export const FIXTURE_IDS = { CHUNK, IMAGE }
