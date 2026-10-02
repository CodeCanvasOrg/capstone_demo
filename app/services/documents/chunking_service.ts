import { createHash, randomUUID } from 'node:crypto'

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { countTokens } from 'gpt-tokenizer'

import openRouterApiConfig from '#config/open_router'
import type { CanonicalBlock, IndexedChunk, PreparedDocument } from './rag_types.ts'

const MAX_CHUNK_TOKENS = 600
const CHUNK_OVERLAP_TOKENS = 60

export default class ChunkingService {
  private splitter = new RecursiveCharacterTextSplitter({
    chunkSize: MAX_CHUNK_TOKENS,
    chunkOverlap: CHUNK_OVERLAP_TOKENS,
    lengthFunction: countTokens,
  })

  async chunk(blocks: CanonicalBlock[]): Promise<PreparedDocument> {
    const orderedBlocks = blocks
      .map((block, orderIndex) => ({ ...block, orderIndex, sectionPath: [] as string[] }))
      .sort((left, right) => left.orderIndex - right.orderIndex)
    const sectionTitles: string[] = []
    const chunks: IndexedChunk[] = []
    let groupedText = ''
    let groupedBlockIds: string[] = []
    let groupedLocator: CanonicalBlock['sourceLocator'] | null = null
    let groupedSection = ''
    let groupedSourceKey = ''

    const createChunk = (content: string, blockIds: string[], block: CanonicalBlock) => {
      const tokenCount = countTokens(content)
      if (tokenCount > MAX_CHUNK_TOKENS) {
        throw new Error(`Chunk exceeds the configured token limit (${tokenCount})`)
      }

      const inputHash = createHash('sha256')
        .update(
          [
            openRouterApiConfig.embeddingModel,
            openRouterApiConfig.pipelineVersion,
            openRouterApiConfig.embeddingDimensions,
            content,
          ].join('\0')
        )
        .digest('hex')

      chunks.push({
        id: randomUUID(),
        chunkIndex: chunks.length,
        content,
        fileKey: block.sourceLocator.fileKey,
        fileName: block.sourceLocator.fileName,
        fileUrl: block.sourceLocator.fileUrl,
        mediaType: block.sourceLocator.mediaType,
        pageNumber: block.sourceLocator.pageNumber ?? null,
        kind: block.blockType === 'image' ? 'image' : 'text',
        tokenCount,
        contentHash: createHash('sha256').update(content).digest('hex'),
        inputHash,
        blockIds: [...new Set(blockIds)],
      })
    }

    const flushGroup = () => {
      if (!groupedText || !groupedLocator || groupedBlockIds.length === 0) return
      const firstBlock = orderedBlocks.find((block) => block.id === groupedBlockIds[0])
      if (!firstBlock) return
      createChunk(groupedText, groupedBlockIds, firstBlock)
      groupedText = ''
      groupedBlockIds = []
      groupedLocator = null
      groupedSection = ''
      groupedSourceKey = ''
    }

    for (const block of orderedBlocks) {
      if (block.blockType === 'heading') {
        flushGroup()
        const level = Math.min(6, Math.max(1, Number(block.sourceLocator.headingLevel) || 1))
        sectionTitles.splice(level - 1)
        sectionTitles[level - 1] = block.text
        block.sectionPath = sectionTitles.filter(Boolean)
        continue
      }

      block.sectionPath = sectionTitles.filter(Boolean)
      const sectionPrefix = block.sectionPath.length
        ? `Section: ${block.sectionPath.join(' > ')}\n\n`
        : ''
      const content = `${sectionPrefix}${block.text}`.trim()

      if (block.blockType === 'image') {
        flushGroup()
        const parts = await this.splitter.splitText(content)
        for (const part of parts) createChunk(part, [block.id], block)
        continue
      }

      const sectionKey = block.sectionPath.join(' > ')
      const sourceKey = [
        block.sourceLocator.fileKey,
        block.sourceLocator.fileUrl,
        block.sourceLocator.pageNumber ?? '',
      ].join('\0')
      const nextText = groupedText ? `${groupedText}\n\n${block.text}` : content
      if (
        groupedText &&
        (groupedSection !== sectionKey ||
          groupedSourceKey !== sourceKey ||
          countTokens(nextText) > MAX_CHUNK_TOKENS)
      ) {
        flushGroup()
      }

      if (countTokens(content) > MAX_CHUNK_TOKENS) {
        flushGroup()
        const parts = await this.splitter.splitText(content)
        for (const part of parts) createChunk(part, [block.id], block)
        continue
      }

      groupedText = groupedText ? `${groupedText}\n\n${block.text}` : content
      groupedBlockIds.push(block.id)
      groupedLocator = block.sourceLocator
      groupedSection = sectionKey
      groupedSourceKey = sourceKey
    }

    flushGroup()
    return { blocks: orderedBlocks, chunks }
  }
}
