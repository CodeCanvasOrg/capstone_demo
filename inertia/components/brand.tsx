export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center bg-primary text-sm font-extrabold text-primary-foreground [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]"
      >
        H
      </span>
      {!compact && <span className="text-xs font-extrabold tracking-wider">CODECANVAS</span>}
    </div>
  )
}
