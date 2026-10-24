import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Familiar utility actions keep a name for keyboard, hover, and assistive use. */
export function IconButton({
  label,
  icon: Icon,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children' | 'asChild' | 'size'> & {
  label: string
  icon: LucideIcon
}) {
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" {...props} aria-label={label}>
          <Icon aria-hidden="true" className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
