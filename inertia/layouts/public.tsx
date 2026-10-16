import type { ReactNode } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme_toggle'
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between border-b bg-sidebar p-5">
        <Link route="home">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>
      <main id="main-content" className="mx-auto max-w-2xl px-5 py-20">
        {children}
      </main>
    </div>
  )
}
