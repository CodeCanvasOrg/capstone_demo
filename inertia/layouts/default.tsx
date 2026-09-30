import { type Data } from '@generated/data'
import { toast } from 'sonner'
import { usePage } from '@inertiajs/react'
import { type ReactElement, useEffect } from 'react'
import { Form, Link } from '@adonisjs/inertia/react'
import { ThemeProvider } from '@/components/theme_provider'
import { ThemeToggle } from '@/components/theme_toggle'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { url, flash } = usePage()
  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash.error) {
      toast.error(flash.error)
    }
    if (flash.success) {
      toast.success(flash.success)
    }
  })

  return (
    <ThemeProvider>
      <TooltipProvider>
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link route="home" className="text-foreground transition-opacity hover:opacity-70">
              <svg
                width="120"
                height="24"
                viewBox="0 0 195 38"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M180 37.5v-30h-7.5V0H195v7.5h-7.5v30H180ZM150 15V7.5h-15V0h15v7.5h7.5V15H150Zm-15 22.5V30h-7.5V7.5h7.5V30h15v7.5h-15Zm15-7.5v-7.5h7.5V30H150ZM82.5 37.5v-30H90V0h15v7.5h7.5v30H105v-15H90v15h-7.5ZM90 15h15V7.8H90V15ZM45 37.5V0h22.5v7.5h-15V15h15v7.5h-15V30h15v7.5H45ZM0 37.5V0h22.5v7.5H30V15h-7.5v15H30v7.5h-7.5V30H15v-7.5H7.5v15H0ZM7.5 15h14.7V7.5H7.5V15Z"
                  fill="currentColor"
                />
              </svg>
            </Link>
            <nav className="flex items-center gap-2">
              {children.props.user ? (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link route="documents.index">Documents</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link route="files.index">Files</Link>
                  </Button>
                  <span className="mx-1 flex size-7 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
                    {children.props.user.initials}
                  </span>
                  <Form route="session.destroy">
                    <Button type="submit" variant="outline" size="sm">
                      Logout
                    </Button>
                  </Form>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link route="new_account.create">Signup</Link>
                  </Button>
                  <Button asChild variant="default" size="sm">
                    <Link route="session.create">Login</Link>
                  </Button>
                </>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </ThemeProvider>
  )
}
