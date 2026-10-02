import { type ReactNode } from 'react'
import { Reveal } from '@/components/reveal'

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div className="min-w-0 max-w-xl space-y-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="size-2 bg-primary" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="font-heading text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="break-words text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </Reveal>
  )
}
