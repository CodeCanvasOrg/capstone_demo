import { test } from '@japa/runner'

import {
  attachChunkMetadata,
  type SourceChunk,
  type TipTapDocument,
} from '#services/documents/chunk_metadata_service'

const imageChunk: SourceChunk = {
  id: 'image-chunk-1',
  chunkIndex: 2,
  content: 'A diagram showing the onboarding sequence',
  fileName: 'onboarding.png',
  fileUrl: 'https://files.example.test/onboarding.png',
  mediaType: 'image/png',
  pageNumber: 4,
}

test.group('ChunkMetadataService | attachChunkMetadata', () => {
  test('resolves citation and image metadata from retrieved chunks', ({ assert }) => {
    const document: TipTapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The onboarding was redesigned.' },
            { type: 'sourceCitation', attrs: { sourceChunkId: imageChunk.id } },
          ],
        },
        {
          type: 'image',
          attrs: {
            sourceChunkId: imageChunk.id,
            src: 'https://attacker.example/replace.png',
          },
        },
      ],
    }

    const result = attachChunkMetadata(document, [imageChunk])
    const citation = result.content[0].content?.[1]
    const image = result.content[1]

    assert.equal(citation?.attrs?.chunkText, imageChunk.content)
    assert.equal(citation?.attrs?.fileUrl, imageChunk.fileUrl)
    assert.equal(citation?.attrs?.pageNumber, 4)
    assert.equal(image.attrs?.src, imageChunk.fileUrl)
    assert.equal(image.attrs?.chunkText, imageChunk.content)
  })

  test('removes unknown source IDs and image references without an image URL', ({ assert }) => {
    const document: TipTapDocument = {
      type: 'doc',
      content: [
        { type: 'sourceCitation', attrs: { sourceChunkId: 'not-retrieved' } },
        { type: 'image', attrs: { sourceChunkId: 'text-chunk' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'Safe content remains.' }] },
      ],
    }
    const textChunk: SourceChunk = {
      id: 'text-chunk',
      chunkIndex: 0,
      content: 'A source paragraph.',
      fileName: 'report.pdf',
      fileUrl: 'https://files.example.test/report.pdf',
      mediaType: 'application/pdf',
    }

    const result = attachChunkMetadata(document, [textChunk])

    assert.lengthOf(result.content, 1)
    assert.equal(result.content[0].type, 'paragraph')
  })
})
