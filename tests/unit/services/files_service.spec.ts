import { test } from '@japa/runner'
import { Readable } from 'node:stream'
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
