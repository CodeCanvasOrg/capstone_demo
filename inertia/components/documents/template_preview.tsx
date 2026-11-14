import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { specFor, type PreviewBlock, type PreviewSpec } from './template_specs'

const PAGE_W = 210
const PAGE_H = 297

const bar = (width: number, height = 3, opacity = 0.5, color = 'var(--m)'): CSSProperties => ({
  width: `${width}%`,
  height,
  borderRadius: height,
  background: color,
  opacity,
})

function Lines({ n, last = 62, tone = 'var(--m)' }: { n: number; last?: number; tone?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={bar(i === n - 1 ? last : 100, 3, 0.42, tone)} />
      ))}
    </div>
  )
}

function Heading({ width = 46, color = 'var(--p)' }: { width?: number; color?: string }) {
  return <div style={bar(width, 5, 0.92, color)} />
}

const label = (_text: string, color = 'var(--at)'): CSSProperties => ({
  fontSize: 5,
  fontWeight: 800,
  letterSpacing: 1.1,
  color,
  textTransform: 'uppercase',
})

function Hero({ spec }: { spec: PreviewSpec }) {
  const { design } = spec
  const dark = design === 'case_study' || design === 'technical' || design === 'vision'
  const title = (
    <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1, letterSpacing: -0.3 }}>
      {spec.title}
    </div>
  )
  const wordmark = (color: string) => (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 6, fontWeight: 700, color }}
    >
      <i
        style={{
          width: 6,
          height: 7,
          background: 'var(--a)',
          clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)',
        }}
      />
      HumbleBee AI
    </div>
  )
  const kicker = (color: string, prefix = '') => (
    <div style={{ fontSize: 5.5, fontWeight: 800, letterSpacing: 1.4, color }}>
      {prefix}
      {spec.kicker}
    </div>
  )
  const image = (
    <div
      style={{
        width: 54,
        height: 54,
        flex: 'none',
        borderRadius: 7,
        background:
          'linear-gradient(140deg, var(--a), color-mix(in oklch, var(--a) 40%, var(--p)))',
        boxShadow:
          design === 'portfolio'
            ? 'inset 0 0 0 1px var(--s)'
            : 'inset 0 0 0 1px rgb(255 255 255 / .35)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '46% -10% -20% 12%',
          borderRadius: '50% 50% 0 0',
          background: 'var(--p)',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 9,
          right: 10,
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: '#fff',
          opacity: 0.85,
        }}
      />
    </div>
  )
  if (design === 'freeform')
    return (
      <div style={{ display: 'grid', gap: 7, paddingTop: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15, color: 'var(--p)' }}>
          {spec.title}
        </div>
        <Lines n={2} last={70} />
      </div>
    )
  if (design === 'portfolio')
    return (
      <div
        style={{
          margin: '-16px -16px 0',
          padding: '14px 16px 12px',
          background: '#fff',
          borderBottom: '1px solid var(--s)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            {wordmark('var(--p)')}
            <div
              style={{
                width: 'fit-content',
                padding: '2px 6px',
                borderRadius: 99,
                background: 'var(--a)',
                color: 'var(--p)',
                fontSize: 5,
                fontWeight: 800,
                letterSpacing: 1.2,
              }}
            >
              {spec.kicker}
            </div>
            <div style={{ color: 'var(--p)' }}>{title}</div>
            <Lines n={2} last={55} />
            <div
              style={{
                width: 34,
                height: 3,
                borderRadius: 2,
                background: 'var(--a)',
                marginTop: 2,
              }}
            />
          </div>
          {image}
        </div>
      </div>
    )
  const background =
    design === 'vision'
      ? 'radial-gradient(circle at 96% 0%, color-mix(in srgb, var(--a) 30%, transparent), transparent 34%), linear-gradient(135deg, var(--p) 0%, color-mix(in srgb, var(--p) 80%, #fff) 100%)'
      : design === 'technical'
        ? 'linear-gradient(rgb(255 255 255 / .07) 1px, transparent 1px) 0 0 / 11px 11px, linear-gradient(90deg, rgb(255 255 255 / .07) 1px, transparent 1px) 0 0 / 11px 11px, var(--p)'
        : 'var(--p)'
  return (
    <div style={{ margin: '-16px -16px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 10,
          padding: '14px 16px 15px',
          background,
          color: '#fff',
        }}
      >
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          {wordmark('#fff')}
          {kicker('var(--a)', design === 'technical' ? '// ' : '')}
          {title}
          <Lines n={2} last={50} tone="#fff" />
        </div>
        {design !== 'technical' && image}
      </div>
      {design === 'case_study' && dark && <div style={{ height: 3, background: 'var(--a)' }} />}
    </div>
  )
}

const Stat = ({ n, text }: { n: string; text: string }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--p)', lineHeight: 1 }}>{n}</div>
    <div style={bar(85, 2.5, 0.5, 'var(--p)')} />
    <div
      style={{
        width: 'fit-content',
        padding: '1px 4px',
        border: '1px solid var(--p)',
        borderRadius: 99,
        fontSize: 4,
        fontWeight: 800,
        letterSpacing: 0.8,
        color: 'var(--p)',
      }}
    >
      {text}
    </div>
  </div>
)

function Cap({ i, spec }: { i: number; spec: PreviewSpec }) {
  const { design } = spec
  const status = ['DELIVERED', 'PILOT', 'PLANNED', 'PLANNED'][i]
  return (
    <div
      style={{
        display: 'grid',
        gap: 4,
        padding: 7,
        background: design === 'portfolio' ? '#fff' : 'var(--s)',
        borderRadius: design === 'technical' ? '0 5px 5px 0' : 5,
        border: design === 'portfolio' ? '1px solid var(--s)' : undefined,
        borderTop:
          design === 'portfolio'
            ? '2.5px solid var(--a)'
            : design === 'vision'
              ? '2.5px solid var(--p)'
              : undefined,
        borderLeft: design === 'technical' ? '2.5px solid var(--p)' : undefined,
      }}
    >
      {design === 'vision' && (
        <div
          style={{
            width: 'fit-content',
            padding: '1px 5px',
            borderRadius: 99,
            fontSize: 4,
            fontWeight: 800,
            letterSpacing: 0.8,
            background: i === 0 ? 'var(--p)' : i === 1 ? 'var(--a)' : 'transparent',
            border: i > 1 ? '1px dashed var(--p)' : undefined,
            color: i === 0 ? '#fff' : 'var(--p)',
          }}
        >
          {status}
        </div>
      )}
      <Heading width={62} />
      <Lines n={2} last={60} />
    </div>
  )
}

const BLOCKS: Record<PreviewBlock, (spec: PreviewSpec) => ReactNode> = {
  hero: (spec) => <Hero spec={spec} />,
  stats: (spec) =>
    spec.design === 'portfolio' ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          ['3×', 'CLIENT REPORTED'],
          ['−38%', 'MEASURED'],
          ['12 wks', 'ESTIMATED'],
        ].map(([n, t]) => (
          <div key={n} style={{ paddingLeft: 6, borderLeft: '2.5px solid var(--a)' }}>
            <Stat n={n} text={t} />
          </div>
        ))}
      </div>
    ) : (
      <div
        style={{
          margin: '0 -16px',
          padding: '9px 16px 10px',
          background: 'var(--a)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        {[
          ['90%', 'ESTIMATED'],
          ['97%', 'CLIENT REPORTED'],
          ['1,000', 'DESIGN TARGET'],
        ].map(([n, t]) => (
          <Stat key={n} n={n} text={t} />
        ))}
      </div>
    ),
  cols: (spec) => {
    const heads =
      spec.design === 'technical'
        ? ['The problem', 'The approach']
        : spec.design === 'vision'
          ? ['User need', 'Product vision']
          : ['The challenge', 'The solution']
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {heads.map((h, i) => (
          <div
            key={h}
            style={{
              display: 'grid',
              gap: 5,
              alignContent: 'start',
              paddingLeft:
                spec.design === 'portfolio' || (spec.design === 'vision' && i === 0) ? 6 : 0,
              borderLeft:
                spec.design === 'portfolio'
                  ? '2.5px solid var(--a)'
                  : spec.design === 'vision' && i === 0
                    ? '3px solid var(--a)'
                    : undefined,
            }}
          >
            <div style={label(h)}>{h}</div>
            {spec.design === 'vision' && i === 0 ? (
              <div style={{ fontSize: 8.5, fontWeight: 800, lineHeight: 1.3, color: 'var(--p)' }}>
                People lose hours finding what they already know.
              </div>
            ) : (
              <Lines n={6} last={48} />
            )}
          </div>
        ))}
      </div>
    )
  },
  steps: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        paddingTop: 7,
        borderTop: '2.5px solid var(--p)',
      }}
    >
      {['01', '02', '03'].map((n) => (
        <div key={n} style={{ display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--at)' }}>{n}</div>
          <Heading width={60} />
          <Lines n={2} last={55} />
        </div>
      ))}
    </div>
  ),
  pipeline: () => (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={label('Architecture')}>Architecture</div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {['Ingest', 'Queue', 'Serve'].map((name, i) => (
          <div key={name} style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                padding: '6px 6px 7px',
                background: 'var(--s)',
                border: '1px solid var(--p)',
                borderRadius: 3,
                display: 'grid',
                gap: 3,
              }}
            >
              <div style={{ fontSize: 5, fontWeight: 800, letterSpacing: 1, color: 'var(--at)' }}>
                0{i + 1}
              </div>
              <div style={{ fontSize: 6.5, fontWeight: 800, color: 'var(--p)' }}>{name}</div>
              <Lines n={2} last={55} />
            </div>
            {i < 2 && (
              <i
                style={{
                  flex: 'none',
                  width: 11,
                  height: 8,
                  margin: '0 2px',
                  background: 'var(--p)',
                  clipPath: 'polygon(0 40%, 60% 40%, 60% 5%, 100% 50%, 60% 95%, 60% 60%, 0 60%)',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  ),
  caps: (spec) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={label(spec.design === 'technical' ? 'Implementation' : 'Capabilities')}>
        {spec.design === 'technical'
          ? 'Implementation'
          : spec.design === 'portfolio'
            ? 'What we built'
            : 'Capabilities'}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: spec.design === 'case_study' ? 'repeat(3, 1fr)' : '1fr 1fr',
          gap: 6,
        }}
      >
        {Array.from({ length: spec.design === 'case_study' ? 3 : 4 }, (_, i) => (
          <Cap key={i} i={i} spec={spec} />
        ))}
      </div>
    </div>
  ),
  metrics: () => (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={label('Evaluation')}>Evaluation</div>
      <div style={{ display: 'grid' }}>
        {[
          ['120 ms', 'MEASURED'],
          ['99.9%', 'MEASURED'],
          ['50 rps', 'DESIGN TARGET'],
        ].map(([n, t], i) => (
          <div
            key={n}
            style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr auto',
              alignItems: 'center',
              gap: 6,
              padding: '5px 6px',
              background: i % 2 === 0 ? 'var(--s)' : 'transparent',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: 'var(--p)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n}
            </div>
            <Lines n={2} last={60} />
            <div
              style={{
                padding: '1px 4px',
                border: '1px solid var(--p)',
                borderRadius: 99,
                fontSize: 4,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: 'var(--p)',
              }}
            >
              {t}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  limits: () => (
    <div
      style={{
        padding: '7px 9px',
        background: 'var(--s)',
        borderLeft: '3px solid var(--a)',
        borderRadius: '0 5px 5px 0',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={label('Limitations', 'var(--p)')}>Limitations</div>
      <Lines n={3} last={55} />
    </div>
  ),
  roadmap: (spec) => (
    <div
      style={
        spec.design === 'case_study'
          ? {
              padding: '7px 9px',
              border: '1px dashed var(--m)',
              borderRadius: 5,
              display: 'grid',
              gap: 4,
            }
          : {
              padding: '7px 9px',
              background: 'var(--s)',
              borderLeft: '3px solid var(--a)',
              borderRadius: '0 5px 5px 0',
              display: 'grid',
              gap: 4,
            }
      }
    >
      <div style={label('Roadmap', 'var(--p)')}>
        {spec.design === 'portfolio' ? 'Next steps' : 'Roadmap'}
      </div>
      <Lines n={2} last={65} />
    </div>
  ),
  timeline: () => (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={label('Roadmap')}>Roadmap</div>
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          paddingTop: 11,
          borderTop: '2px solid var(--p)',
        }}
      >
        {['Now', 'Next', 'Later'].map((when) => (
          <div key={when} style={{ position: 'relative', display: 'grid', gap: 3 }}>
            <i
              style={{
                position: 'absolute',
                top: -16,
                left: 0,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--a)',
                boxShadow: '0 0 0 2px var(--p)',
              }}
            />
            <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--p)' }}>{when}</div>
            <Lines n={3} last={55} />
          </div>
        ))}
      </div>
    </div>
  ),
  cta: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '9px 10px',
        borderRadius: 6,
        background: 'var(--p)',
      }}
    >
      <div style={{ flex: 1 }}>
        <Heading width={70} color="#fff" />
      </div>
      <div
        style={{
          flex: 'none',
          padding: '4px 9px',
          borderRadius: 99,
          background: 'var(--a)',
          color: 'var(--p)',
          fontSize: 6,
          fontWeight: 800,
        }}
      >
        Get in touch
      </div>
    </div>
  ),
  sources: () => (
    <div style={{ display: 'grid', gap: 4, paddingTop: 6, borderTop: '1px solid var(--s)' }}>
      <div style={{ fontSize: 5, fontWeight: 800, letterSpacing: 1, color: 'var(--m)' }}>
        SOURCES
      </div>
      <Lines n={3} last={70} />
    </div>
  ),
  plain: () => (
    <div style={{ display: 'grid', gap: 9 }}>
      <Lines n={4} last={60} />
      <div style={{ fontWeight: 800, fontSize: 9, color: 'var(--p)' }}>Heading</div>
      <Lines n={4} last={45} />
      <div style={{ display: 'grid', gap: 4 }}>
        {[80, 66, 74].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--p)' }} />
            <div style={{ ...bar(w, 3, 0.42), flex: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 800, fontSize: 9, color: 'var(--p)' }}>Heading</div>
      <Lines n={5} last={52} />
    </div>
  ),
}

export function PreviewPage({ spec, page }: { spec: PreviewSpec; page: number }) {
  const { palette } = spec
  return (
    <div
      style={
        {
          '--p': palette.primary,
          '--a': palette.accent,
          '--at': palette.accentText,
          '--t': palette.ink,
          '--m': palette.muted,
          '--bg': palette.bg,
          '--s': palette.surface,
          'position': 'relative',
          'width': PAGE_W,
          'height': PAGE_H,
          'overflow': 'hidden',
          'boxSizing': 'border-box',
          'padding': 16,
          'display': 'flex',
          'flexDirection': 'column',
          'gap': 11,
          'background': palette.bg,
          'color': palette.ink,
          'fontFamily': "'Manrope Variable', Manrope, system-ui, sans-serif",
        } as CSSProperties
      }
    >
      {spec.pages[page].map((block, i) => {
        const node = BLOCKS[block](spec)
        return node ? <div key={`${block}-${i}`}>{node}</div> : null
      })}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 5.5,
          fontWeight: 700,
          color: 'var(--m)',
        }}
      >
        <div style={bar(18, 2.5, 0.35)} />
        <span>{String(page + 1).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

/** A flat, scaled-down first page for the template picker. */
export function PreviewThumb({ id, width = 84 }: { id: string; width?: number }) {
  const spec = specFor(id)
  const scale = width / PAGE_W
  return (
    <div
      aria-hidden="true"
      style={{ width, height: PAGE_H * scale, overflow: 'hidden', borderRadius: 3 }}
    >
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <PreviewPage spec={spec} page={0} />
      </div>
    </div>
  )
}

// Four tones for the sheet edge, light to dark, so the stack reads as solid paper.
const EDGE = ['#d9dde4', '#c3c9d3', '#aab1be', '#939ba9']
const GAP_OPEN = 52
const GAP_CLOSED = 3

function Scene({ id, spec }: { id: string; spec: PreviewSpec }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const pages = spec.pages.length
  const centre = ((pages - 1) * GAP_OPEN) / 2
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: PAGE_W,
        height: PAGE_H,
        marginLeft: -PAGE_W / 2,
        marginTop: -PAGE_H / 2,
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 18,
          background: 'rgb(8 10 20 / .5)',
          filter: 'blur(16px)',
          transform: `translateZ(${-centre - 34}px) translate(10px, 12px)`,
        }}
      />
      {spec.pages.map((_, i) => {
        const z = (open ? i * GAP_OPEN : i * GAP_CLOSED) - centre
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transformStyle: 'preserve-3d',
              transform: `translateZ(${z}px)`,
              transition: 'transform 560ms var(--ease-out)',
              transitionDelay: `${i * 70}ms`,
            }}
          >
            {EDGE.map((tone, layer) => (
              <div
                key={layer}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 2,
                  background: tone,
                  transform: `translateZ(${-(layer + 1) * 0.9}px)`,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 0 0 .5px rgb(0 0 0 / .18)',
              }}
            >
              <PreviewPage spec={spec} page={i} />
              {i === pages - 1 && <div key={id} className="preview-sweep" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The selected template as a stack of sheets seen from above. The sheets fan
 * apart when a template is chosen, and the whole stack leans toward the pointer.
 */
export function TemplatePreview({ id }: { id: string }) {
  const spec = specFor(id)
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 110, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 110, damping: 18, mass: 0.6 })
  const rz = useTransform(sx, [-1, 1], [-47, -33])
  const rx = useTransform(sy, [-1, 1], [64, 52])
  const transform = useMotionTemplate`rotateX(${rx}deg) rotateZ(${rz}deg)`
  const { accent, primary } = spec.palette
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onPointerMove={(event) => {
        if (reduce || event.pointerType === 'touch') return
        const box = event.currentTarget.getBoundingClientRect()
        px.set(((event.clientX - box.left) / box.width) * 2 - 1)
        py.set(((event.clientY - box.top) / box.height) * 2 - 1)
      }}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={id}
          className="absolute inset-0"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 55% at 50% 52%, color-mix(in oklch, ${accent} 34%, transparent), transparent 72%), linear-gradient(180deg, color-mix(in oklch, ${primary} 12%, transparent), transparent 60%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-[.35]"
            style={{
              backgroundImage:
                'radial-gradient(circle, color-mix(in oklch, currentColor 40%, transparent) 1px, transparent 1.2px)',
              backgroundSize: '18px 18px',
              maskImage: 'radial-gradient(70% 70% at 50% 50%, black, transparent)',
            }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              transform: reduce ? 'rotateX(60deg) rotateZ(-40deg)' : transform,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="preview-float absolute inset-0"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: 'scale(var(--preview-scale, 1))',
                  transformStyle: 'preserve-3d',
                }}
              >
                <Scene id={id} spec={spec} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
