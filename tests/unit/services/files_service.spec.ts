import { test } from '@japa/runner'
import { Readable } from 'node:stream'
import FileService from '#services/documents/files_service'
import drive from '@adonisjs/drive/services/main'

type MockFileService = {
  processImage: (image: string | Buffer, imageKey?: string) => Promise<unknown[]>
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
  test('throws error for unsupported file type', async ({ assert }) => {
    const fileProps = {
      filename: 'test.txt',
      objectKey: 'test.txt',
      objectUrl: 'url',
    }

    // Mock drive.use().getStream to avoid actual file system access
    const restoreDrive = mockDriveStream(Buffer.alloc(0))

    try {
      await assert.rejects(() => FileService.processFile(fileProps), 'Unsupported file type: .txt')
    } finally {
      restoreDrive()
    }
  })

  test('processes images correctly', async ({ assert }) => {
    const fileProps = {
      filename: 'test.png',
      objectKey: 'test.png',
      objectUrl: 'url',
    }

    const restoreDrive = mockDriveStream(Buffer.from('fake-image-data'))

    // OCR is an external dependency, so the recognition step is replaced
    // with a stub to keep this test a fast, offline unit test
    const mockFileService = FileService as unknown as MockFileService
    const originalProcessImage = mockFileService.processImage
    mockFileService.processImage = async () => [
      {
        chunkIndex: 0,
        content: 'mock recognized text',
        fileKey: 'test.png',
        embedding: [0.1, 0.2],
      },
    ]

    try {
      const result = await FileService.processFile(fileProps)

      assert.equal(result.filename, fileProps.filename)
      assert.equal(result.filetype, '.png')
      assert.isTrue(Array.isArray(result.chunks))
      assert.lengthOf(result.chunks, 1)
    } finally {
      mockFileService.processImage = originalProcessImage
      restoreDrive()
    }
  })
})
