import { test } from '@japa/runner'

import EmbeddFileService from '#services/documents/embedd_file_service'

type TestableEmbeddFileService = {
  embeddText: (text: string) => Promise<number[]>
  similaritySearch: (
    query: string,
    vectors: number[][]
  ) => Promise<Array<{ index: number; similarity: number }>>
}

test.group('EmbeddFileService | similaritySearch', () => {
  test('ranks the closest vectors first and excludes low similarity results', async ({
    assert,
  }) => {
    const service = new EmbeddFileService() as unknown as TestableEmbeddFileService
    service.embeddText = async () => [0, 0, 1]

    const result = await service.similaritySearch('query', [
      [1, 0, 0],
      [0.6, 0, 0.8],
      [0, 0, 1],
      [0, 1, 0],
    ])

    assert.deepEqual(
      result.map(({ index }) => index),
      [2, 1]
    )
    assert.isAbove(result[0].similarity, result[1].similarity)
  })
})
