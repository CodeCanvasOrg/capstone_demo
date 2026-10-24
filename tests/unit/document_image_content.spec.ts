import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import ContentService from '#services/documents/content_service'
import DocumentImageService from '#services/documents/document_image_service'
import { attachChunkMetadata } from '#services/documents/chunk_metadata_service'
import { getStructuredOutput } from '#services/structured_model_output_service'
import { PNG, JPEG } from '../fixtures/document_image.ts'

test.group('Document image content', () => {
  test('checks image signatures, size, emptiness and extension mismatches', ({ assert }) => {
    assert.equal(DocumentImageService.mime('photo.PNG', PNG), 'image/png')
    assert.equal(DocumentImageService.mime('photo.jpeg', JPEG), 'image/jpeg')
    const invalidJpeg = Buffer.alloc(24, 0xff)
    invalidJpeg[1] = 0xd8
    invalidJpeg[23] = 0xd9
    for (const [name, bytes] of [
      ['fake.png', Buffer.from('<svg onload="alert(1)"></svg>')],
      ['fake.jpg', PNG],
      ['empty.png', Buffer.alloc(0)],
      ['large.png', Buffer.alloc(10 * 1024 * 1024 + 1)],
      ['truncated.png', PNG.subarray(0, 24)],
      ['invalid.jpg', invalidJpeg],
    ] as const)
      assert.throws(() => DocumentImageService.mime(name, bytes))
  })
  test('normalizes editor attachments without granting generated content attachment IDs', ({
    assert,
  }) => {
    const id = randomUUID()
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            documentImageId: id,
            sourceChunkId: null,
            src: 'https://untrusted.invalid',
            alt: 'Diagram',
            title: null,
            width: 300,
            height: null,
            align: 'left',
          },
        },
      ],
    }
    const normalized = new ContentService().normalize(content)
    assert.equal(normalized.content[0].attrs?.documentImageId, id)
    assert.notProperty(normalized.content[0].attrs, 'src')
    const generated = getStructuredOutput().parse({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { documentImageId: id },
        },
      ],
    })
    assert.notProperty(generated.content[0].attrs, 'documentImageId')
    const hydrated = attachChunkMetadata(
      normalized,
      [],
      new Map([
        [
          id,
          {
            id,
            filename: 'photo.png',
            mime: 'image/png',
            src: '/authorized/image',
          },
        ],
      ])
    )
    assert.equal(hydrated.content[0].attrs?.src, '/authorized/image')
    assert.equal(hydrated.content[0].attrs?.width, 300)
    assert.equal(hydrated.content[0].attrs?.align, 'left')
    assert.lengthOf(attachChunkMetadata(normalized, []).content, 0)
    assert.throws(() =>
      new ContentService().normalize({
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { documentImageId: 'invalid' },
          },
        ],
      })
    )
  })
})
