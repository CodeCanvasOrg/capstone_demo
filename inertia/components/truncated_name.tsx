import { useRef, useState } from 'react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A single-line name that ends in "…" when it does not fit and shows the full name in a tooltip
 * on hover. The tooltip only opens when the text is actually cut off; the full name stays in the
 * DOM, so screen readers and search always get all of it.
 */
export function TruncatedName({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <Tooltip
      delayDuration={350}
      open={open}
      onOpenChange={(next) => {
        const element = ref.current
        setOpen(next && !!element && element.scrollWidth > element.clientWidth)
      }}
    >
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('block min-w-0 truncate', className)}>
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent className="break-all">{name}</TooltipContent>
    </Tooltip>
  )
}
