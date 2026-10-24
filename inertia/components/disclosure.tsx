import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, type LucideIcon } from 'lucide-react'

/** Native details keeps form/editor state mounted while its contents are hidden. */
export function Disclosure({
  title,
  icon: Icon = SlidersHorizontal,
  summary,
  children,
  reveal = false,
  defaultOpen = false,
}: {
  title: string
  icon?: LucideIcon
  summary?: ReactNode
  children: ReactNode
  reveal?: boolean
  defaultOpen?: boolean
}) {
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (reveal && details.current) details.current.open = true
  }, [reveal])
  return (
    <details ref={details} open={defaultOpen || undefined} className="group/disclosure border-t">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs font-semibold select-none [&::-webkit-details-marker]:hidden">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span>{title}</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground">{summary}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 group-open/disclosure:rotate-180"
        />
      </summary>
      <div className="space-y-4 px-5 pb-5">{children}</div>
    </details>
  )
}
