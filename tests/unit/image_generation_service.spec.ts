import { test } from '@japa/runner'
import sharp from 'sharp'
import env from '#start/env'
import ImageGenerationService, {
  DEFAULT_IMAGE_MODEL,
  ILLUSTRATION_LABEL,
  ImageGenerationFailure,
  PRINT_SIZE,
} from '#services/canvas/image_generation_service'
import { composePortfolio, frameIdFor } from '../../shared/canvas/portfolio/compose.ts'
import { SAMPLE } from '../../shared/canvas/portfolio/sample.ts'
import { walkNodes } from '../../shared/canvas/model.ts'

async function picture(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#14213d' } })
    .png()
    .toBuffer()
}

const answer = async (width: number, height: number) => ({
  bytes: await picture(width, height),
  mime: 'image/png',
  costUsd: 0.0665,
  latencyMs: 1234,
  text: null,
})

test.group('ImageGenerationService', (group) => {
  group.each.teardown(() => {
    ImageGenerationService.restore()
    env.set('CANVAS_IMAGE_GENERATION', undefined as never)
    env.set('CANVAS_IMAGE_MODEL', '')
  })

  test('it is off unless CANVAS_IMAGE_GENERATION is on, and the model has a default', ({
    assert,
  }) => {
    assert.isFalse(ImageGenerationService.enabled())
    assert.equal(ImageGenerationService.model(), DEFAULT_IMAGE_MODEL)
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    env.set('CANVAS_IMAGE_MODEL', 'vendor/other-image')
    assert.isTrue(ImageGenerationService.enabled())
    assert.equal(ImageGenerationService.model(), 'vendor/other-image')
  })

  test('the print size is the single-picture figure cell at 300 dpi', ({ assert }) => {
    assert.deepEqual(PRINT_SIZE, { width: 897, height: 1266 })
  })

  test('the prompt carries the entry, the palette and the no-text rule, and no source text', ({
    assert,
  }) => {
    const prompt = ImageGenerationService.illustrationPrompt({
      title: 'Cooling districts',
      intro: 'Trees and permeable paving lower summer heat.',
      category: 'Urban heat',
    })
    assert.include(prompt, 'Cooling districts')
    assert.include(prompt, 'Urban heat')
    assert.include(prompt, 'Trees and permeable paving')
    assert.include(prompt, '#14213d')
    assert.include(prompt, '#f2a900')
    assert.match(prompt, /no text, no letters/)
    assert.match(prompt, /not a photograph/)
  })

  test('the picture is fitted to the print size and the model, prompt and cost are recorded', async ({
    assert,
  }) => {
    let seen: { model: string; prompt: string; references: unknown[] } | undefined
    ImageGenerationService.fake(async (input) => {
      seen = input
      return answer(896, 1200)
    })
    const made = await new ImageGenerationService().generate({ prompt: 'A navy and gold sketch' })
    const meta = await sharp(made.bytes).metadata()
    assert.equal(meta.width, PRINT_SIZE.width)
    assert.equal(meta.height, PRINT_SIZE.height)
    assert.equal(made.mime, 'image/png')
    assert.equal(seen?.model, DEFAULT_IMAGE_MODEL)
    assert.deepEqual(seen?.references, [])
    assert.deepInclude(made.record, {
      model: DEFAULT_IMAGE_MODEL,
      prompt: 'A navy and gold sketch',
      costUsd: 0.0665,
      sourceWidth: 896,
      sourceHeight: 1200,
      referenceCount: 0,
    })
  })

  test('reference pictures are passed to the provider and counted', async ({ assert }) => {
    let count = -1
    ImageGenerationService.fake(async (input) => {
      count = input.references.length
      return answer(896, 1200)
    })
    const bytes = await picture(40, 40)
    const made = await new ImageGenerationService().generate({
      prompt: 'p',
      references: [{ bytes, mime: 'image/png' }],
    })
    assert.equal(count, 1)
    assert.equal(made.record.referenceCount, 1)
  })

  test('a picture too small to print is refused', async ({ assert }) => {
    ImageGenerationService.fake(() => answer(300, 400))
    const error = await new ImageGenerationService().generate({ prompt: 'p' }).catch((e) => e)
    assert.instanceOf(error, ImageGenerationFailure)
    assert.equal(error.reason, 'unusable')
  })

  test('bytes that are not a picture are refused', async ({ assert }) => {
    ImageGenerationService.fake(async () => ({
      ...(await answer(10, 10)),
      bytes: Buffer.from('no'),
    }))
    const error = await new ImageGenerationService().generate({ prompt: 'p' }).catch((e) => e)
    assert.instanceOf(error, ImageGenerationFailure)
  })

  test('a provider error and a refusal become typed failures', async ({ assert }) => {
    ImageGenerationService.fake(async () => {
      throw Object.assign(new Error('boom'), { status: 502 })
    })
    const provider = await new ImageGenerationService().generate({ prompt: 'p' }).catch((e) => e)
    assert.instanceOf(provider, ImageGenerationFailure)
    assert.equal(provider.reason, 'provider')
    assert.notInclude(provider.message, 'boom')

    ImageGenerationService.fake(async () => {
      throw Object.assign(new Error('none'), { unusableOutput: true })
    })
    const refused = await new ImageGenerationService().generate({ prompt: 'p' }).catch((e) => e)
    assert.equal(refused.reason, 'refused')
  })

  test('a guard that throws stops the call and is not turned into a failure', async ({
    assert,
  }) => {
    let called = false
    ImageGenerationService.fake(async () => {
      called = true
      return answer(896, 1200)
    })
    const lost = new Error('lease lost')
    const error = await new ImageGenerationService()
      .generate({
        prompt: 'p',
        guard: async () => {
          throw lost
        },
      })
      .catch((e) => e)
    assert.strictEqual(error, lost)
    assert.isFalse(called)
  })
})

test.group('portfolio template: AI illustration label', () => {
  const textOf = (canvas: ReturnType<typeof composePortfolio>, slot: string) => {
    const f = canvas.sheets[1].frames.find((x) => x.id === frameIdFor(canvas.sheets[1].id, slot))
    const parts: string[] = []
    if (f?.kind === 'text')
      walkNodes(f.doc, (n) => {
        if (n.type === 'text') parts.push(String((n as { text?: unknown }).text))
      })
    return f ? parts.join('') : null
  }
  const entry = (generated?: boolean) => ({
    ...SAMPLE.entries[0],
    sampleFigure: false,
    images: [{ imageId: '00000000-0000-4000-8000-000000000001', alt: 'Art', generated }],
  })

  test('a generated picture prints its label, a real one does not', ({ assert }) => {
    const labelled = composePortfolio({ ...SAMPLE, entries: [entry(true)] })
    assert.equal(textOf(labelled, 'figure-label'), ILLUSTRATION_LABEL)
    const plain = composePortfolio({ ...SAMPLE, entries: [entry(false)] })
    assert.isNull(textOf(plain, 'figure-label'))
  })
})
