import { type ReactNode } from 'react'
import { ArrowUpRight, FileText, ScanText } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Card, CardContent } from '@/components/ui/card'

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:gap-16">
      <Reveal className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          A workspace for your ideas
        </p>
        <h2 className="max-w-md font-heading text-4xl leading-tight sm:text-5xl">
          Your work.
          <br />A story worth telling.
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Bring your source files together, create a draft, and make every detail your own.
        </p>
        <div className="flex items-center gap-3 border-t border-border pt-6" aria-hidden="true">
          <span className="flex size-12 items-center justify-center border border-border bg-card">
            <ScanText className="size-5" />
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
            <FileText className="size-5" />
          </span>
          <ArrowUpRight className="ml-2 size-5 text-muted-foreground" />
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <Card className="border-t-2 border-t-primary py-8">
          <CardContent className="space-y-7 px-6 sm:px-8">
            <div className="space-y-2">
              <h1 className="font-heading text-3xl">{title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
            {children}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}
