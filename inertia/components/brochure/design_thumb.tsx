import type { CSSProperties } from 'react'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import type { DesignId } from '../../../shared/brochure/designs.ts'
import { Ribbons } from '../ribbons'

/**
 * A small drawing of each page design, in the brand's colours, so a design is
 * recognised at a glance. Sizes are container units, so it looks the same at any
 * width. Decorative: the label beside it names the design for assistive technology.
 */
const palette = getBrandKit('humblebee')!.palette
const tokens = {
  '--bd-navy': palette.primary,
  '--bd-yellow': palette.accent,
  '--bd-hl': `color-mix(in srgb, ${palette.accentText} 76%, #000)`,
  '--bd-surface': palette.surface,
} as CSSProperties

const Lines = ({ n, w = 100 }: { n: number; w?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <i key={i} className="bd-line" style={{ width: `${i === n - 1 ? w * 0.6 : w}%` }} />
    ))}
  </>
)

const cols = (n: number, mark = true) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} className="bd-col">
      {mark && <b className="bd-head" />}
      <Lines n={4} />
    </div>
  ))

export function DesignThumb({ design, className = '' }: { design: DesignId; className?: string }) {
  return (
    <div aria-hidden="true" className={`bd-thumb ${className}`} data-design={design} style={tokens}>
      {design === 'cover' && (
        <>
          <Ribbons
            seed="cover"
            lines={12}
            step={10}
            weight={0.7}
            stroke="var(--bd-yellow)"
            className="bd-fill"
          />
          <div className="bd-bottom">
            <b className="bd-white" style={{ width: '62%' }} />
            <b className="bd-white" style={{ width: '44%' }} />
            <i className="bd-white thin" style={{ width: '50%' }} />
          </div>
        </>
      )}
      {design === 'proof' && (
        <>
          <div className="bd-side">
            <i className="bd-white thin" />
            <i className="bd-white thin" style={{ width: '70%' }} />
            <b className="bd-white" style={{ marginTop: 'auto', width: '80%' }} />
          </div>
          <div className="bd-points">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bd-pt">
                <span className="bd-badge" />
                <div>
                  <b className="bd-head" />
                  <Lines n={2} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {design === 'article' && (
        <div className="bd-pad">
          <b className="bd-title" style={{ width: '62%' }} />
          <Lines n={5} />
          <div className="bd-bullets">
            <Lines n={3} w={55} />
          </div>
          <b className="bd-head" style={{ width: '58%', marginTop: '3cqw' }} />
          <b className="bd-head big" style={{ width: '46%' }} />
          <span className="bd-ring" />
        </div>
      )}
      {design === 'offer' && (
        <>
          <div className="bd-band">
            <b className="bd-white" style={{ width: '28%' }} />
            <span className="bd-num">30</span>
          </div>
          <div className="bd-pad" style={{ top: '39%' }}>
            <b className="bd-title" style={{ width: '40%' }} />
            <div className="bd-cols">{cols(3)}</div>
          </div>
          <div className="bd-foot" />
        </>
      )}
      {design === 'glance' && (
        <>
          <div className="bd-pad" style={{ bottom: 'auto' }}>
            <b className="bd-title" style={{ width: '70%' }} />
          </div>
          <div className="bd-gband">
            <div className="bd-cards">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bd-card">
                  <b className="bd-head" />
                  <Lines n={3} />
                </div>
              ))}
            </div>
            <i className="bd-strip" />
            <i className="bd-strip y" />
          </div>
          <div className="bd-table">
            {[0, 1, 2].map((i) => (
              <i key={i} className="bd-row" />
            ))}
          </div>
        </>
      )}
      {design === 'columns' && (
        <>
          <div className="bd-band short">
            <b className="bd-white" style={{ width: '30%' }} />
            <span className="bd-bulb" />
          </div>
          <div className="bd-pad" style={{ top: '34%' }}>
            <b className="bd-head big" style={{ width: '60%' }} />
            <div className="bd-cols">{cols(3)}</div>
          </div>
        </>
      )}
      {design === 'insight' && (
        <div className="bd-pad">
          <div className="bd-cols">
            {cols(3).map((c, i) => (
              <div key={i} className="bd-colwrap">
                {c}
                {i === 2 && <div className="bd-art" />}
              </div>
            ))}
          </div>
        </div>
      )}
      {design === 'recognition' && (
        <>
          <div className="bd-pad" style={{ bottom: 'auto' }}>
            <div className="bd-split">
              <b className="bd-head big" style={{ width: '70%' }} />
              <div>
                <Lines n={3} />
              </div>
            </div>
            <b className="bd-head big" style={{ width: '50%', marginTop: '10cqw' }} />
          </div>
          <div className="bd-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bd-award">
                <b className="bd-title" style={{ width: '70%' }} />
                <Lines n={2} w={70} />
              </div>
            ))}
          </div>
        </>
      )}
      {design === 'contact' && (
        <div className="bd-pad">
          <b className="bd-title" style={{ width: '38%' }} />
          <b className="bd-head" style={{ width: '30%' }} />
          <Lines n={3} w={40} />
          <b className="bd-title small" style={{ width: '34%', marginTop: '6cqw' }} />
          <Lines n={4} w={86} />
          <i className="bd-line" style={{ width: '40%', marginTop: 'auto', opacity: 0.2 }} />
        </div>
      )}
    </div>
  )
}
