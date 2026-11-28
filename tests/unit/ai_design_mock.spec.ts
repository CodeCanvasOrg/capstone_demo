import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import {
  canvasDesignSchema,
  designPageContentSchema,
} from '../../shared/canvas/ai_design/schema.ts'
import { normalizeDesign } from '../../shared/canvas/ai_design/normalize.ts'
import { validateDesign } from '../../shared/canvas/ai_design/validate.ts'

/** Runs the Postman OpenRouter mock's request handler in-process, without a socket. */
function mock() {
  let handler: (req: unknown, res: unknown) => void = () => {}
  const source = readFileSync('postman/mocks/openrouter/default.js', 'utf8')
  const http = {
    createServer(h: typeof handler) {
      handler = h
      return { listen() {} }
    },
  }
  new Function('require', 'process', source)((name: string) => (name === 'http' ? http : null), {
    env: { PORT: '0' },
  })
  return (name: string, content: unknown) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const res = {
        writeHead() {},
        end: (text: string) => resolve(JSON.parse(text)),
      }
      handler(
        {
          method: 'POST',
          url: '/api/v1/chat/completions',
          body: {
            model: 'm',
            tools: [{ function: { name } }],
            messages: [{ role: 'user', content: JSON.stringify(content) }],
          },
        },
        res
      )
    })
}

const args = (body: Record<string, unknown>) =>
  JSON.parse(
    (body as { choices: { message: { tool_calls: { function: { arguments: string } }[] } }[] })
      .choices[0].message.tool_calls[0].function.arguments
  )

test.group('Postman OpenRouter mock: AI design', () => {
  test('design_canvas answers a design the pipeline accepts, with the requested page count', async ({
    assert,
  }) => {
    const call = mock()
    for (const pages of [3, 5]) {
      const parsed = canvasDesignSchema.safeParse(args(await call('design_canvas', { pages })))
      assert.isTrue(parsed.success)
      if (!parsed.success) return
      assert.lengthOf(parsed.data.pages, pages)
      const { design } = normalizeDesign(parsed.data)
      assert.deepEqual(validateDesign(design, { pages, allowBrandFont: false }), [])
    }
  })

  test('write_design_page answers one text per listed frame, citing a supplied chunk', async ({
    assert,
  }) => {
    const out = args(
      await mock()('write_design_page', {
        frames: [
          { id: 'title', cite: false },
          { id: 'body', cite: true },
        ],
        sources: '[Source chunk ID: abc-1; File: a.pdf; Chunk: 1]\ntext',
      })
    )
    const parsed = designPageContentSchema.parse(out)
    assert.deepEqual(
      parsed.frames.map((f) => [f.id, f.chunks]),
      [
        ['title', []],
        ['body', ['abc-1']],
      ]
    )
  })
})
