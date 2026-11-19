import type { ReactNode } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { Brand } from '@/components/brand'
import { Bee } from '@/components/bee/bee'
import { Ribbons } from '@/components/ribbons'
import { ThemeToggle } from '@/components/theme_toggle'
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-primary focus:p-3"
      >
        Skip to content
      </a>
      <aside className="auth-aside relative hidden min-h-svh flex-col justify-between overflow-hidden p-12 text-background lg:flex">
        <Link route="home">
          <Brand />
        </Link>
        <div className="relative z-10 max-w-lg">
          <p className="mb-8 text-sm font-semibold text-background/70">HumbleBeeAI / CodeCanvas</p>
          <h1 className="page-title text-6xl">
            Good work
            <br />
            deserves a<br />
            <span className="text-primary">clear story.</span>
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-background/70">
            Turn your team’s knowledge into case studies that make the work understandable. One
            shared workspace, from source to sign-off.
          </p>
        </div>
        <p className="relative z-10 text-xs text-background/60">
          Human direction. Intelligent systems.
        </p>
        <Ribbons seed="HumbleBee AI" width={210} height={297} lines={40} className="auth-ribbons" />
        <Bee className="auth-bee" />
      </aside>
      <div className="flex min-h-svh flex-col bg-sidebar">
        <header className="flex items-center justify-between p-6 lg:justify-end">
          <Link route="home" className="lg:hidden">
            <Brand />
          </Link>
          <ThemeToggle />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="m-auto w-full max-w-md px-7 py-12 outline-none"
        >
          {children}
        </main>
        <footer className="p-6 text-center text-xs text-muted-foreground">
          A little structure. More room for your ideas.
        </footer>
      </div>
    </div>
  )
}
