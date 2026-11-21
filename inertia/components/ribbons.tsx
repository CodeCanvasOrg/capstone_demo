/**
 * Flowing light ribbons: the brochure's one decorative device. The same seed
 * always draws the same curves, so a workspace or portfolio keeps its own
 * artwork. Decorative only, and drawn once: the stroke is a brand colour, so it
 * follows the theme.
 */
function hashOf(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

export function Ribbons({
  seed,
  width = 210,
  height = 297,
  lines = 34,
  step = 5,
  weight = 0.4,
  stroke = 'var(--primary)',
  className,
}: {
  seed: string
  width?: number
  height?: number
  lines?: number
  step?: number
  weight?: number
  stroke?: string
  className?: string
}) {
  const h = hashOf(seed)
  const phase = (h % 628) / 100
  const swing = 0.8 + ((h >> 3) % 60) / 100
  const k = height / 297
  const paths = Array.from({ length: lines }, (_, i) => {
    const t = i / (lines - 1)
    const pts: string[] = []
    for (let x = -step; x <= width + step; x += step) {
      const u = x / width
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05)))
      const y =
        (112 +
          (t - 0.5) * 60 * (0.35 + env) +
          Math.sin(u * 6.2 + phase + t * 2.6) * 26 * swing * env) *
        k
      pts.push(`${x},${y.toFixed(1)}`)
    }
    const opacity = (0.25 + 0.7 * Math.sin(Math.PI * t) ** 1.6).toFixed(2)
    return (
      <polyline
        key={i}
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth={weight}
      />
    )
  })
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      {paths}
    </svg>
  )
}
