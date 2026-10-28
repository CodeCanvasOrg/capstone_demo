import { createHash, randomUUID } from 'node:crypto'

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { countTokens } from 'gpt-tokenizer'

import type { CanonicalBlock, ChunkPlanGroup, IndexedChunk, PreparedDocument } from './rag_types.ts'

// Content budget. Retrieval context (≤ 120 tokens) is embedded with it, and the embedding input
// must stay under EmbeddingService's 700-token limit.
export const MAX_CHUNK_TOKENS = 520
const CHUNK_OVERLAP_TOKENS = 50

export default class ChunkingService {
  async chunk(blocks: CanonicalBlock[], plan?: ChunkPlanGroup[]): Promise<PreparedDocument> {
    const orderedBlocks = blocks
      .map((block, orderIndex) => ({ ...block, orderIndex, sectionPath: [] as string[] }))
      .sort((left, right) => left.orderIndex - right.orderIndex)
    this.assignSections(orderedBlocks)
    const chunks: IndexedChunk[] = []

    const createChunk = (content: string, blockIds: string[], block: CanonicalBlock) => {
      const tokenCount = countTokens(content)
      if (tokenCount > MAX_CHUNK_TOKENS) {
        throw new Error(`Chunk exceeds the configured token limit (${tokenCount})`)
      }

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
        blockIds: [...new Set(blockIds)],
      })
    }

    // Text that may exceed the budget is split so every part still fits with its prefix.
    const emit = async (prefix: string, body: string, ids: string[], first: CanonicalBlock) => {
      const content = `${prefix}${body}`.trim()
      if (countTokens(content) <= MAX_CHUNK_TOKENS) return createChunk(content, ids, first)
      for (const part of await this.split(body, MAX_CHUNK_TOKENS - countTokens(prefix)))
        createChunk(`${prefix}${part}`.trim(), ids, first)
    }

    if (plan) {
      const byId = new Map(orderedBlocks.map((block) => [block.id, block]))
      for (const group of plan) {
        const members = group.blockIds.map((id) => {
          const block = byId.get(id)
          if (!block || block.blockType === 'heading')
            throw new Error(`Chunk plan references an invalid block ${id}`)
          return block
        })
        const [first] = members
        const table = members.every((block) => block.blockType === 'table_row')
        const body = members.map((block) => block.text).join(table ? '\n' : '\n\n')
        const header = table && group.header ? `${group.header}\n` : ''
        await emit(
          `${this.sectionPrefix(first)}${header}`,
          body,
          members.map((block) => block.id),
          first
        )
      }
      return { blocks: orderedBlocks, chunks }
    }

    let groupedText = ''
    let groupedBlockIds: string[] = []
    let groupedSection = ''
    let groupedSourceKey = ''

    const flushGroup = () => {
      if (!groupedText || groupedBlockIds.length === 0) return
      const firstBlock = orderedBlocks.find((block) => block.id === groupedBlockIds[0])
      if (!firstBlock) return
      createChunk(groupedText, groupedBlockIds, firstBlock)
      groupedText = ''
      groupedBlockIds = []
      groupedSection = ''
      groupedSourceKey = ''
    }

    for (const block of orderedBlocks) {
      if (block.blockType === 'heading') {
        flushGroup()
        continue
      }

      const sectionPrefix = this.sectionPrefix(block)
      const content = `${sectionPrefix}${block.text}`.trim()

      if (block.blockType === 'image') {
        flushGroup()
        await emit(sectionPrefix, block.text, [block.id], block)
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
        await emit(sectionPrefix, block.text, [block.id], block)
        continue
      }

      groupedText = groupedText ? `${groupedText}\n\n${block.text}` : content
      groupedBlockIds.push(block.id)
      groupedSection = sectionKey
      groupedSourceKey = sourceKey
    }

    flushGroup()
    return { blocks: orderedBlocks, chunks }
  }

  /** Headings set the section path of every following block until a heading of equal level. */
  private assignSections(blocks: CanonicalBlock[]) {
    const sectionTitles: string[] = []
    for (const block of blocks) {
      if (block.blockType === 'heading') {
        const level = Math.min(6, Math.max(1, Number(block.sourceLocator.headingLevel) || 1))
        sectionTitles.splice(level - 1)
        sectionTitles[level - 1] = block.text
      }
      block.sectionPath = sectionTitles.filter(Boolean)
    }
  }

  private sectionPrefix(block: CanonicalBlock) {
    return block.sectionPath.length ? `Section: ${block.sectionPath.join(' > ')}\n\n` : ''
  }

  private split(text: string, budget: number) {
    return new RecursiveCharacterTextSplitter({
      chunkSize: budget,
      chunkOverlap: Math.min(CHUNK_OVERLAP_TOKENS, Math.floor(budget / 4)),
      lengthFunction: countTokens,
    }).splitText(text)
  }
}
