import { type Data } from '@generated/data'
import { toast } from 'sonner'
import { usePage } from '@inertiajs/react'
import { type ReactElement, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Menu, LogOut, Files, FileText, ArrowUpRight } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'
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
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <TooltipProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:p-3 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <header className="border-b border-border bg-background">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <Link
                route="home"
                aria-label="REACT home"
                className="shrink-0 text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <svg
                  className="w-20 sm:w-30"
                  aria-hidden="true"
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
              <nav aria-label="Main navigation" className="flex items-center gap-2">
                {children.props.user ? (
                  <>
                    <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                      <Link
                        route="documents.index"
                        aria-current={url.startsWith('/documents') ? 'page' : undefined}
                        className={cn(
                          url.startsWith('/documents') && 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        <FileText aria-hidden="true" className="size-4" />
                        Documents
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                      <Link
                        route="files.index"
                        aria-current={url.startsWith('/files') ? 'page' : undefined}
                        className={cn(
                          url.startsWith('/files') && 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        <Files aria-hidden="true" className="size-4" />
                        Files
                      </Link>
                    </Button>
                    <span
                      aria-label={`Signed in as ${children.props.user.initials}`}
                      className="mx-1 hidden size-7 sm:flex items-center justify-center bg-primary text-sm font-semibold text-primary-foreground"
                    >
                      {children.props.user.initials}
                    </span>
                    <Form route="session.destroy" className="hidden sm:block">
                      {({ processing }) => (
                        <Button type="submit" variant="ghost" size="sm" disabled={processing}>
                          {processing ? 'Signing out…' : 'Logout'}
                        </Button>
                      )}
                    </Form>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="sm:hidden"
                          aria-label="Open navigation"
                        >
                          <Menu className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link route="documents.index">
                            <FileText aria-hidden="true" />
                            Documents
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link route="files.index">
                            <Files aria-hidden="true" />
                            Files
                          </Link>
                        </DropdownMenuItem>
                        <Form route="session.destroy">
                          {({ processing }) => (
                            <DropdownMenuItem
                              asChild
                              disabled={processing}
                              onSelect={(event) => event.preventDefault()}
                            >
                              <button type="submit" className="w-full">
                                <LogOut aria-hidden="true" />
                                {processing ? 'Signing out…' : 'Logout'}
                              </button>
                            </DropdownMenuItem>
                          )}
                        </Form>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" size="sm">
                      <Link route="session.create">Login</Link>
                    </Button>
                    <Button asChild variant="default" size="sm">
                      <Link route="new_account.create">
                        Get started
                        <ArrowUpRight className="hidden size-4 sm:block" aria-hidden="true" />
                      </Link>
                    </Button>
                  </>
                )}
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </ThemeProvider>
    </MotionConfig>
  )
}
