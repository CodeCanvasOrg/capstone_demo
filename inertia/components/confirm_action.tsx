import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert_dialog'
export function ConfirmAction({
  title,
  description,
  trigger,
  icon: Icon,
  children,
  open,
  onOpenChange,
  returnFocus,
}: {
  title: string
  description: string
  returnFocus?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: string
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm">
            {Icon && <Icon aria-hidden="true" />}
            {trigger}
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (returnFocus) {
            event.preventDefault()
            returnFocus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          {children}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
