import { test } from '@japa/runner'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import type { Worker } from 'tesseract.js'
import FileService from '#services/documents/files_service'
import drive from '@adonisjs/drive/services/main'

const context = {
  actorId: 1,
  workspaceId: '00000000-0000-4000-8000-000000000001',
  membershipId: '00000000-0000-4000-8000-000000000002',
  membershipEpoch: 0,
}
const guard = async () => {}
type MockFileService = {
  createOcrWorker: () => Promise<Worker>
  processImage: (
    image: string | Buffer,
    source: { fileKey: string; fileUrl: string; fileName: string; mediaType: string }
  ) => Promise<unknown[]>
}

const mockDriveStream = (buffer: Buffer) => {
  const originalUse = drive.use

  drive.use = () =>
    ({
      getStream: () => Promise.resolve(Readable.from([buffer])),
    }) as any

  return () => {
    drive.use = originalUse
  }
}

test.group('FileService', () => {
  test('retains all sibling DOCX blocks in document order', async ({ assert }) => {
    const restoreDrive = mockDriveStream(
      await readFile(new URL('../../fixtures/docx/mixed-blocks.docx', import.meta.url))
    )
    try {
      const result = await FileService.processFile(
        {
          uploaderId: 1,
          id: 'docx-file-id',
          filename: 'mixed-blocks.docx',
          objectKey: 'uploads/1/mixed-blocks.docx',
        },
        context,
        guard
      )
      assert.deepEqual(
        result.blocks.map(({ blockType, text }) => ({ blockType, text })),
        [
          { blockType: 'heading', text: 'Project overview' },
          { blockType: 'paragraph', text: 'First paragraph & details.' },
          { blockType: 'paragraph', text: 'Second paragraph.' },
          { blockType: 'list_item', text: 'Evidence item' },
          { blockType: 'table_row', text: 'Name | Value' },
        ]
      )
      assert.equal(result.blocks[0].sourceLocator.headingLevel, 1)
      assert.isTrue(result.blocks.every((block) => block.extractionMethod === 'mammoth-html'))
      assert.isTrue(
        result.blocks.every(
          (block) => block.sourceLocator.fileKey === 'uploads/1/mixed-blocks.docx'
        )
      )
    } finally {
      restoreDrive()
    }
  })

  test('accepts an empty DOCX without a parser error', async ({ assert }) => {
    const restoreDrive = mockDriveStream(
      await readFile(new URL('../../fixtures/docx/empty.docx', import.meta.url))
    )
    try {
      const result = await FileService.processFile(
        {
          uploaderId: 1,
          id: 'empty-docx',
          filename: 'empty.docx',
          objectKey: 'uploads/1/empty.docx',
        },
        context,
        guard
      )
      assert.deepEqual(result.blocks, [])
      assert.deepEqual(result.generatedAssetKeys, [])
    } finally {
      restoreDrive()
    }
  })

  test('retains an embedded DOCX image between sibling paragraphs', async ({ assert }) => {
    const buffer = await readFile(
      new URL('../../fixtures/docx/embedded-image.docx', import.meta.url)
    )
    const originalUse = drive.use
    const service = FileService as unknown as MockFileService
    const originalWorker = service.createOcrWorker
    const stored: { key: string; data: Buffer; options: unknown }[] = []
    let recognized: unknown
    let terminated = false
    service.createOcrWorker = async () =>
      ({
        recognize: async (image: unknown) => {
          recognized = image
          return { data: { text: 'Image caption', confidence: 90 } }
        },
        terminate: async () => {
          terminated = true
        },
      }) as unknown as Worker
    drive.use = () =>
      ({
        getStream: async () => Readable.from([buffer]),
        put: async (key: string, data: Buffer, options: unknown) => {
          stored.push({ key, data, options })
        },
      }) as any
    try {
      const result = await FileService.processFile(
        {
          uploaderId: 1,
          id: 'image-docx',
          filename: 'image.docx',
          objectKey: 'uploads/1/image.docx',
        },
        context,
        guard
      )
      assert.deepEqual(
        result.blocks.map((block) => [block.blockType, block.text]),
        [
          ['paragraph', 'Before image.'],
          ['image', 'Image caption'],
          ['paragraph', 'After image.'],
        ]
      )
      assert.lengthOf(stored, 1)
      assert.deepEqual(stored[0].options, { contentType: 'image/png', visibility: 'private' })
      assert.deepEqual(recognized, stored[0].data)
      assert.deepEqual(result.generatedAssetKeys, [stored[0].key])
      assert.equal(result.blocks[1].sourceLocator.fileKey, stored[0].key)
      assert.equal(result.blocks[1].extractionMethod, 'mammoth-image-ocr')
      assert.isTrue(terminated)
    } finally {
      drive.use = originalUse
      service.createOcrWorker = originalWorker
    }
  })

  test('extracts PDF text with a non-embedded standard font without pdf.js warnings', async ({
    assert,
  }) => {
    const restoreDrive = mockDriveStream(
      await readFile(new URL('../../fixtures/pdf/standard-font.pdf', import.meta.url))
    )
    const logged: string[] = []
    const { log, warn } = console
    console.log = console.warn = (...args: unknown[]) => logged.push(args.join(' '))
    try {
      const result = await FileService.processFile(
        {
          uploaderId: 1,
          id: 'pdf-file-id',
          filename: 'standard-font.pdf',
          objectKey: 'uploads/1/standard-font.pdf',
        },
        context,
        guard
      )
      assert.include(result.blocks[0].text, 'Standard font evidence')
      assert.equal(result.blocks[0].extractionMethod, 'pdf-text')
      assert.deepEqual(
        logged.filter((line) => line.includes('standardFontDataUrl')),
        []
      )
    } finally {
      console.log = log
      console.warn = warn
      restoreDrive()
    }
  })

  test('throws error for unsupported file type', async ({ assert }) => {
    const fileProps = {
      uploaderId: 1,
      id: 'test-file-id',
      filename: 'test.csv',
      objectKey: 'test.csv',
    }

    // Mock drive.use().getStream to avoid actual file system access
    const restoreDrive = mockDriveStream(Buffer.alloc(0))

    try {
      await assert.rejects(
        () => FileService.processFile(fileProps, context, guard),
        'Unsupported file type: .csv'
      )
    } finally {
      restoreDrive()
    }
  })

  test('does not process a file key owned by a different user', async ({ assert }) => {
    await assert.rejects(
      () =>
        FileService.processFile(
          {
            uploaderId: 1,
            id: 'other-file-id',
            filename: 'other-user.png',
            objectKey: 'uploads/2/other-user.png',
          },
          context,
          guard
        ),
      'File storage reference is outside its workspace lineage'
    )
  })

  test('processes images correctly', async ({ assert }) => {
    const fileProps = {
      uploaderId: 1,
      id: 'test-file-id',
      filename: 'test.png',
      objectKey: 'uploads/1/test.png',
    }

    const restoreDrive = mockDriveStream(Buffer.from('fake-image-data'))

    // OCR is an external dependency, so the recognition step is replaced
    // with a stub to keep this test a fast, offline unit test
    const mockFileService = FileService as unknown as MockFileService
    const originalProcessImage = mockFileService.processImage
    mockFileService.processImage = async (_image, source) => [
      {
        id: 'test-block-id',
        blockType: 'image',
        text: 'mock recognized text',
        orderIndex: 0,
        sectionPath: [],
        sourceLocator: {
          fileKey: source.fileKey,
          fileUrl: source.fileUrl,
          fileName: source.fileName,
          mediaType: source.mediaType,
        },
        extractionMethod: 'mock',
        confidence: 0.8,
      },
    ]

    try {
      const result = await FileService.processFile(fileProps, context, guard)

      assert.equal(result.filename, fileProps.filename)
      assert.equal(result.filetype, '.png')
      assert.equal(
        result.blocks[0].sourceLocator.fileUrl,
        `/workspaces/${context.workspaceId}/files/${fileProps.id}/download`
      )
      assert.equal(result.blocks[0].sourceLocator.mediaType, 'image/png')
      assert.isTrue(Array.isArray(result.blocks))
      assert.lengthOf(result.blocks, 1)
    } finally {
      mockFileService.processImage = originalProcessImage
      restoreDrive()
    }
  })
})
