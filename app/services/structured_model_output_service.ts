import { z } from 'zod'
import { ChatPromptTemplate } from '@langchain/core/prompts'

function getStructuredOutput() {
  // Tiptap JSON marks (e.g., bold, italic, link)
  const TiptapMarkSchema = z.object({
    type: z.enum(['bold', 'italic', 'strike', 'underline', 'code', 'link']),
    attrs: z.record(z.string(), z.any()).optional(),
  })

  // Base type for typescript recursion compilation
  interface TiptapNode {
    type: string
    text?: string
    attrs?: Record<string, any>
    marks?: z.infer<typeof TiptapMarkSchema>[]
    content?: TiptapNode[]
  }

  // Defining the recursive Node schema using z.lazy()
  const TiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
    z.object({
      type: z.enum([
        'paragraph',
        'heading',
        'text',
        'bulletList',
        'listItem',
        'blockquote',
        'codeBlock',
      ]),
      text: z.string().optional().describe("Only used if type is 'text'"),
      attrs: z
        .object({
          level: z.number().min(1).max(6).optional().describe('Used for heading nodes (1-6)'),
        })
        .optional(),
      marks: z.array(TiptapMarkSchema).optional(),
      content: z.array(TiptapNodeSchema).optional().describe('Children nodes inside this block'),
    })
  )

  // The top-level document wrap required by Tiptap
  const TiptapDocSchema = z.object({
    type: z.literal('doc'),
    content: z.array(TiptapNodeSchema),
  })

  return TiptapDocSchema
}

function getInitPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are an expert copywriter and document architect. Your task is to transform a user's rough title and description into a highly polished, professional document.

  You must structure the content layout with the following hierarchy:
  1. **Main Heading**: Create a compelling, high-impact Heading (Level 1) based on the user's title.
  2. **Executive Summary**: Write a concise, 2-3 sentence paragraph summarizing the core value proposition or objective. It should act as an introductory abstract.
  3. **Document Body**: Expand on the short description provided. Break this down logically using a combination of sub-headings (Level 2 or 3), structured paragraphs, and a bulleted or numbered list where appropriate to make the text scannable and engaging.

  Focus heavily on deep, valuable writing. Do not use conversational filler (like "Sure, here is your document"). Begin directly with the content.`,
    ],
    [
      'human',
      `Generate a document using these inputs:
      - **Title Idea**: {title}
      - **Short Description**: {description}`,
    ],
  ])
}

export { getStructuredOutput, getInitPrompt }
