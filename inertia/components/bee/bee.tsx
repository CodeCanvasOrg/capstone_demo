import { useId } from 'react'
import { cn } from 'cn'

export type BeeMood = 'idle' | 'wave' | 'think' | 'cheer' | 'work'

/**
 * Bo, the CodeCanvas bee. Pure SVG; every motion lives in the `.bee-*` rules in app.css
 * (transform and opacity only), so it stays on the compositor and respects reduced motion.
 */
export function Bee({
  mood = 'idle',
  className,
  title,
}: {
  mood?: BeeMood
  className?: string
  title?: string
}) {
  const id = useId()
  const clip = `${id}-body`
  return (
    <svg
      viewBox="0 0 120 124"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-mood={mood}
      className={cn('bee', className)}
    >
      <defs>
        <clipPath id={clip}>
          <ellipse cx="60" cy="68" rx="32" ry="31" />
        </clipPath>
        <radialGradient id={`${id}-fur`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#fbc520" />
          <stop offset="1" stopColor="#ec9f0b" />
        </radialGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#cfe3ff" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <ellipse className="bee-shadow" cx="60" cy="118" rx="22" ry="3.5" />

      <g className="bee-body">
        <g className="bee-antenna bee-antenna-l">
          <path
            d="M50 38 Q45 22 35 19"
            fill="none"
            stroke="#2a1d08"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="35" cy="19" r="3.6" fill="#2a1d08" />
        </g>
        <g className="bee-antenna bee-antenna-r">
          <path
            d="M70 38 Q75 22 85 19"
            fill="none"
            stroke="#2a1d08"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="85" cy="19" r="3.6" fill="#2a1d08" />
        </g>

        <g className="bee-wing bee-wing-l">
          <ellipse
            cx="34"
            cy="52"
            rx="19"
            ry="10.5"
            transform="rotate(-32 34 52)"
            fill={`url(#${id}-wing)`}
            stroke="#b9cff0"
            strokeWidth="1"
          />
        </g>
        <g className="bee-wing bee-wing-r">
          <ellipse
            cx="86"
            cy="52"
            rx="19"
            ry="10.5"
            transform="rotate(32 86 52)"
            fill={`url(#${id}-wing)`}
            stroke="#b9cff0"
            strokeWidth="1"
          />
        </g>

        <path d="M55 96 L60 109 L65 96 Z" fill="#2a1d08" />
        <ellipse cx="60" cy="68" rx="32" ry="31" fill={`url(#${id}-fur)`} />
        <g clipPath={`url(#${clip})`} fill="#2a1d08">
          <rect x="20" y="85" width="80" height="7.5" />
          <rect x="20" y="97" width="80" height="9" />
        </g>
        <ellipse
          cx="46"
          cy="47"
          rx="9"
          ry="4.5"
          transform="rotate(-28 46 47)"
          fill="#fff"
          opacity="0.38"
        />

        <g className="bee-eyes" fill="#2a1d08">
          <g className="bee-eye">
            <ellipse cx="48" cy="64" rx="4.2" ry="5.4" />
            <circle cx="49.6" cy="62" r="1.5" fill="#fff" />
          </g>
          <g className="bee-eye">
            <ellipse cx="72" cy="64" rx="4.2" ry="5.4" />
            <circle cx="73.6" cy="62" r="1.5" fill="#fff" />
          </g>
        </g>
        <circle cx="41" cy="73" r="4.4" fill="#ff8a7a" opacity="0.5" />
        <circle cx="79" cy="73" r="4.4" fill="#ff8a7a" opacity="0.5" />
        <path
          className="bee-smile"
          d="M53.5 72.5 Q60 79 66.5 72.5"
          fill="none"
          stroke="#2a1d08"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          className="bee-grin"
          d="M52.5 72 Q60 85 67.5 72 Z"
          fill="#2a1d08"
          stroke="#2a1d08"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          className="bee-tongue"
          d="M56.5 79.5 Q60 77.5 63.5 79.5 Q60 83 56.5 79.5Z"
          fill="#ff8a7a"
        />
      </g>
    </svg>
  )
}
