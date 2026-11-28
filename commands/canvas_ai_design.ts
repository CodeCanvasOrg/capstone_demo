import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * "Let AI choose" for one document, in this process: for trying the design model locally and for
 * tuning its prompt. With --dry-run it runs the digest and the design step and prints the design
 * JSON (design system, every page's frames, what normalising changed, any rule the design still
 * breaks) and saves nothing. Without it, it generates the whole canvas and saves it as a new
 * version, as the "Generate pages" button would.
 */
export default class CanvasAiDesign extends BaseCommand {
  static commandName = 'canvas:ai-design'
  static description =
    'Let the model design a document’s pages; --dry-run prints the design JSON and saves nothing'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Document UUID' })
  declare documentId: string

  @flags.string({ description: 'Workspace UUID (read from the document when omitted)' })
  declare workspace?: string
  @flags.string({ description: 'concise | standard | detailed', default: 'standard' })
  declare depth: string
  @flags.string({ description: 'auto, or the number of entries from 1 to 6', default: 'auto' })
  declare entries: string
  @flags.string({
    description: 'auto, or the exact number of designed pages from 3 to 16',
    default: 'auto',
  })
  declare pages: string
  @flags.boolean({
    description: 'Offer pictures to the design (--no-images skips them)',
    default: true,
    showNegatedVariantInHelp: true,
  })
  declare images: boolean
  @flags.boolean({ description: 'Print the design JSON, save nothing' })
  declare dryRun?: boolean

  async run() {
    const { default: Document } = await import('#models/document')
    const { default: CanvasGenerationService } =
      await import('#services/canvas/generation/canvas_generation_service')
    const { default: CanvasOperator } = await import('#services/canvas/generation/canvas_operator')
    const { default: AiDesignPipeline } =
      await import('#services/canvas/ai_design/ai_design_pipeline')
    const { default: CanvasPipeline } = await import('#services/canvas/generation/canvas_pipeline')

    let options
    try {
      options = new CanvasGenerationService().options({
        templateSet: 'ai_design',
        depth: this.depth,
        entries: this.entries === 'auto' ? 'auto' : Number(this.entries),
        pages: this.pages === 'auto' ? 'auto' : Number(this.pages),
        images: this.images,
      })
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
      return
    }
    const found = this.workspace ? null : await Document.find(this.documentId).catch(() => null)
    const workspaceId = this.workspace ?? found?.workspaceId
    if (!workspaceId) {
      this.logger.error(`No document ${this.documentId}`)
      this.exitCode = 1
      return
    }
    const operator = new CanvasOperator()
    const context = await operator.context(workspaceId)
    const input = await operator.inputs(context, this.documentId)
    const common = {
      context,
      documentId: input.document.id,
      title: input.title,
      brief: input.brief,
      pins: input.pins,
      options,
      guard: async () => {},
    }

    if (this.dryRun) {
      const { digest, result } = await new AiDesignPipeline().design(common)
      this.logger.log(
        JSON.stringify(
          {
            dryRun: true,
            model: result.model,
            pages: digest.pageCount,
            attempts: result.attempts,
            sentPictures: result.sentImages,
            brand: digest.brand?.name ?? null,
            pictures: digest.images.map((p) => ({
              ref: p.ref,
              origin: p.origin,
              size: `${p.width}x${p.height}`,
              aspect: p.aspect,
              caption: p.caption.slice(0, 80),
            })),
            usable: result.problems.length === 0,
            problems: result.problems,
            notes: result.notes,
            design: result.design,
          },
          null,
          2
        )
      )
      if (result.problems.length) this.exitCode = 1
      return
    }

    const generated = await new CanvasPipeline().generate(common)
    const saved = await operator.save(context, input.document, generated, options)
    const m = generated.metrics
    this.logger.log(this.colors.bold(`${input.title}  (saved as ${saved.version.id})`))
    this.logger.log(
      `  ${m.pages} pages, ${m.words} words, average fill ${Math.round(m.avgFill * 100)}%, ${m.citations} citations, ${m.lowDpiImages} low-resolution images, ${Math.round(m.durationMs / 1000)} s, ~${m.tokens} tokens`
    )
    if (generated.fallback)
      this.logger.warning(`  fell back to the portfolio template: ${generated.fallback.reason}`)
    for (const page of generated.pages)
      for (const note of page.notes) this.logger.warning(`  page ${page.index + 1}: ${note}`)
  }
}
