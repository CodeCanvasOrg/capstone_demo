import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import type {
  CanvasDesign,
  DesignFrame,
  DesignPage,
  DesignPageContent,
} from '../../shared/canvas/ai_design/schema.ts'

/** A design that meets every rule: a navy cover, then pages of heading, lead, body and a picture. */
export const PALETTE = {
  ink: '#14213d',
  paper: '#f6f4ee',
  surface: '#ebe7dc',
  primary: '#14213d',
  accent: '#f2a900',
  muted: '#4b5563',
}

const text = (
  id: string,
  role: DesignFrame['role'],
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<DesignFrame> = {}
): DesignFrame => ({
  id,
  kind: 'text',
  role,
  x,
  y,
  w,
  h,
  brief: `The ${role} of the page`,
  ...extra,
})

export function coverPage(): DesignPage {
  return {
    purpose: 'Cover: the title and a one-line summary of the case study.',
    questions: ['What is this case study about?'],
    background: 'paper',
    frames: [
      {
        id: 'band',
        kind: 'shape',
        role: 'panel',
        x: 0,
        y: 0,
        w: 2100,
        h: 1700,
        shape: 'rect',
        style: { fill: 'primary' },
        brief: null,
      },
      {
        id: 'glow',
        kind: 'art',
        role: 'decor',
        x: 1750,
        y: 0,
        w: 350,
        h: 600,
        art: 'glow',
        brief: null,
      },
      text('eyebrow', 'eyebrow', 200, 300, 1500, 90, { style: { color: 'accent' } }),
      text('title', 'title', 200, 480, 1500, 760, { style: { color: 'paper', size: 40 } }),
      text('subtitle', 'subtitle', 200, 1300, 1400, 260, { style: { color: 'paper', size: 13 } }),
      text('footer', 'footer', 200, 2660, 1500, 90, { style: { color: 'muted' } }),
    ],
  }
}

export function contentPage(n: number, withImage = true): DesignPage {
  return {
    purpose: `Page ${n}: what worked in district ${n}.`,
    questions: [`What changed in district ${n}?`, `How was it measured in district ${n}?`],
    background: 'paper',
    frames: [
      text('heading', 'heading', 200, 200, 1700, 300, { style: { size: 26 } }),
      {
        id: 'rule',
        kind: 'shape',
        role: 'rule',
        x: 200,
        y: 520,
        w: 600,
        h: 24,
        shape: 'rect',
        style: { fill: 'accent' },
        brief: null,
      },
      text('lead', 'lead', 200, 620, 1700, 360, { style: { size: 12 } }),
      text('body', 'body', 200, 1100, 1000, 1300, { style: { size: 9.5 } }),
      ...(withImage
        ? [
            {
              id: 'photo',
              kind: 'image',
              role: 'image',
              x: 1350,
              y: 1100,
              w: 550,
              h: 700,
              fit: 'cover',
              subject: 'A picture of the district',
              brief: null,
            } as DesignFrame,
            text('caption', 'caption', 1350, 1850, 550, 200, {
              style: { size: 8, color: 'muted' },
            }),
          ]
        : []),
      {
        id: 'quote-panel',
        kind: 'shape',
        role: 'panel',
        x: 200,
        y: 2450,
        w: 1700,
        h: 300,
        shape: 'rect',
        style: { fill: 'surface' },
        brief: null,
      },
      text('quote', 'quote', 260, 2480, 1580, 240, { style: { size: 12, color: 'ink' } }),
    ],
  }
}

export function sampleDesign(pages = 3, options: { images?: boolean } = {}): CanvasDesign {
  return {
    system: {
      name: 'Navy and gold',
      palette: PALETTE,
      fonts: { heading: 'display', body: 'sans' },
      scale: { caption: 8, body: 9.5, lead: 12, heading: 26, title: 40 },
      grid: { margin: 200, columns: 6, gutter: 60 },
    },
    pages: [
      coverPage(),
      ...Array.from({ length: pages - 1 }, (_, i) => contentPage(i + 2, options.images ?? true)),
    ],
    reviewer_notes: [],
  }
}

export type DesignCall = {
  kind: 'design' | 'page'
  corrections: string[]
  model: string
  images: number
}

export type AiDesignModelOptions = {
  /** The design the model returns (the first call); default `sampleDesign(pages)`. */
  design?: (call: number, pages: number) => CanvasDesign
  /** The model accepts pictures. */
  vision?: boolean
  /** Throw for the page writer. */
  fail?: boolean
  /** Each text is over the frame's space on the first answer. */
  overflow?: boolean
  /** Never fix an over-long text. */
  stubborn?: boolean
  gate?: Promise<void>
}

const SENTENCES = [
  'Surface temperatures fell by 83% across 12 monitored districts in the pilot years.',
  'Planners reviewed the results every summer against the baseline of 2.4x.',
  'Permeable paving and street trees cut surface temperatures in the pilot districts.',
  'The warmest streets were also the ones with the least shade at noon.',
  'The planners kept the cooling measures that worked in each district.',
  'Results are from the pilot only and will be confirmed over a longer period.',
]

/** Stand-ins for the designer and the page writer. Restored by the returned function. */
export function installAiDesignModel(options: AiDesignModelOptions = {}) {
  const proto = OpenRouterService.prototype
  const original = {
    design: proto.designCanvas,
    page: proto.writeDesignPage,
    vision: proto.acceptsImageInput,
    embed: EmbeddingService.prototype.embedQuery,
  }
  const calls: DesignCall[] = []
  let designCalls = 0
  EmbeddingService.prototype.embedQuery = async () =>
    Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))
  proto.acceptsImageInput = async () => options.vision ?? false
  proto.designCanvas = async (input) => {
    await options.gate
    calls.push({
      kind: 'design',
      corrections: input.corrections ?? [],
      model: input.model,
      images: input.images?.length ?? 0,
    })
    const pages = Number(JSON.parse(input.user).pages)
    return (options.design ?? ((_, n) => sampleDesign(n)))(designCalls++, pages)
  }
  proto.writeDesignPage = async (input) => {
    calls.push({
      kind: 'page',
      corrections: input.corrections ?? [],
      model: input.model,
      images: 0,
    })
    if (options.fail) throw Object.assign(new Error('boom'), { status: 500 })
    const payload = JSON.parse(input.user)
    const ids = [...String(payload.sources).matchAll(/Source chunk ID: ([^;]+);/g)].map((m) => m[1])
    const condensed = (input.corrections ?? []).some((c) => /over their space/.test(c))
    const frames = (
      payload.frames as { id: string; role: string; chars: number; cite: boolean }[]
    ).map((f, i) => {
      let value: string
      if (f.role === 'title') value = 'Cooling the city through design'
      else if (f.role === 'eyebrow' || f.role === 'footer' || f.role === 'caption')
        value = 'Urban heat'
      else if (f.role === 'heading') value = `District ${payload.page.number}: what worked`
      else {
        // Sentences up to the character target, so the text fills the frame without overflowing it.
        value = ''
        for (let k = 0; ; k++) {
          const next = `${value}${value ? ' ' : ''}${SENTENCES[(k + i) % SENTENCES.length]}`
          if (next.length > f.chars) break
          value = next
        }
        if (options.overflow && (!condensed || options.stubborn) && f.role === 'body')
          value = `${value} ${SENTENCES.join(' ')} ${SENTENCES.join(' ')} ${SENTENCES.join(' ')} ${SENTENCES.join(' ')}`
      }
      return { id: f.id, text: value, chunks: f.cite && ids.length ? [ids[i % ids.length]] : [] }
    })
    return {
      frames,
      claims: [{ claim: 'Surface temperatures fell', frame: 'body', kind: 'measured' }],
      summary: `Page ${payload.page.number} showed measured cooling.`,
      reviewer_notes: [],
    } as unknown as DesignPageContent
  }
  return {
    calls,
    restore() {
      proto.designCanvas = original.design
      proto.writeDesignPage = original.page
      proto.acceptsImageInput = original.vision
      EmbeddingService.prototype.embedQuery = original.embed
    },
  }
}
