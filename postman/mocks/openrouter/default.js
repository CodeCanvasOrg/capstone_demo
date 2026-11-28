const http = require('http')
// The fixture validates only the client paths exercised by this repository.
// All content is synthetic; it is never a case-study quality assertion.
http
  .createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(501, { error: { message: 'Endpoint not modeled' } })
    const body = req.body ?? {}
    if (!body.model) return send(400, { error: { message: 'model is required' } })
    if (req.url === '/api/v1/embeddings') {
      if (body.input === undefined) return send(400, { error: { message: 'input is required' } })
      const inputs = Array.isArray(body.input) ? body.input : [body.input]
      const dimensions = body.dimensions ?? 1024
      return send(200, {
        object: 'list',
        model: body.model,
        data: inputs.map((_, index) => ({
          object: 'embedding',
          index,
          embedding: Array.from({ length: dimensions }, (_, i) => (i === 0 ? 1 : 0)),
        })),
        usage: { prompt_tokens: 10, total_tokens: 10 },
      })
    }
    if (req.url === '/api/v1/chat/completions') {
      const name = body.tools?.[0]?.function?.name
      if (!Array.isArray(body.messages) || !name)
        return send(400, { error: { message: 'messages and structured function are required' } })
      let generated
      if (name === 'generate_document_title') generated = { title: 'Synthetic generated title' }
      if (name === 'contextualize_chunks') {
        const raw = body.messages
          .map((message) => (typeof message.content === 'string' ? message.content : ''))
          .findLast((text) => text.startsWith('{'))
        generated = {
          contexts: JSON.parse(raw).chunks.map((chunk) => ({
            chunkId: chunk.id,
            context: 'Synthetic context for transport verification only.',
          })),
        }
      }
      const lastJson = () =>
        JSON.parse(
          body.messages
            .flatMap((message) =>
              typeof message.content === 'string'
                ? [message.content]
                : (message.content ?? [])
                    .filter((part) => part.type === 'text')
                    .map((part) => part.text)
            )
            .find((text) => text.startsWith('{')) ?? '{}'
        )
      // Portfolio pipeline (docs/portfolio-template-plan.md): synthetic plan, entry and cover.
      if (name === 'plan_portfolio') {
        const entry = (n) => ({
          title: `Synthetic entry ${n}`,
          category: 'Synthetic category',
          purpose: `Synthetic purpose ${n}, for transport verification only.`,
          questions: [`Synthetic question ${n}a?`, `Synthetic question ${n}b?`],
          keyTerms: [],
          wantsImages: false,
        })
        generated = {
          title: 'Synthetic portfolio for transport verification',
          eyebrow: 'Synthetic portfolio',
          thesis: 'Synthetic thesis for transport verification only.',
          audience: 'Synthetic audience',
          entries: [entry(1), entry(2)],
          coverageGaps: [],
        }
      }
      if (name === 'write_portfolio_entry') {
        const input = lastJson()
        const ids = [...String(input.sources ?? '').matchAll(/Source chunk ID: ([^;]+);/g)].map((m) => m[1])
        const labels = ['Context', 'Research', 'Challenge', 'Approach', 'Solution', 'Evaluation']
        generated = {
          title: input.entry?.title ?? 'Synthetic entry',
          category: input.entry?.category ?? 'Synthetic category',
          intro: 'Synthetic introduction for transport verification only.',
          rows: labels.map((label) => ({
            label,
            body: 'Synthetic row text for transport verification only.',
            chunks: ids.slice(0, 1),
          })),
          claims: [],
          sourceNotes: [],
          summary: 'Synthetic summary.',
          reviewer_notes: ['Synthetic output: not a quality assertion.'],
        }
      }
      if (name === 'write_portfolio_cover')
        generated = {
          eyebrow: 'Synthetic portfolio',
          title: 'Synthetic portfolio for transport verification',
          subtitle: 'Synthetic subtitle for transport verification only.',
          reviewer_notes: [],
        }
      if (name === 'fill_document_outline') {
        const raw = body.messages
          .flatMap((message) =>
            typeof message.content === 'string'
              ? [message.content]
              : (message.content ?? [])
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text)
          )
          .findLast((text) => text.startsWith('{'))
        const input = JSON.parse(raw)
        generated = {
          sections: input.outline.map((section) => ({
            key: section.key,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Synthetic section content for transport verification only.',
                  },
                ],
              },
            ],
          })),
        }
      }
      return send(200, {
        id: 'synthetic-completion',
        object: 'chat.completion',
        created: 1700000000,
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'fixture-call',
                  type: 'function',
                  function: {
                    name,
                    arguments: JSON.stringify(
                      generated ?? {
                        type: 'doc',
                        content: [
                          {
                            type: 'heading',
                            attrs: { level: 1 },
                            content: [{ type: 'text', text: 'Local integration fixture' }],
                          },
                          {
                            type: 'paragraph',
                            content: [
                              {
                                type: 'text',
                                text: 'Synthetic output for transport and tenancy verification only.',
                              },
                            ],
                          },
                        ],
                      }
                    ),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      })
    }
    return send(501, { error: { message: 'Endpoint not modeled' } })
  })
  .listen(process.env.PORT)
