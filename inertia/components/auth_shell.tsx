import type { ReactNode } from 'react'
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
    <section className="space-y-7">
      <div>
        <p className="eyebrow mb-4">Your next chapter</p>
        <h1 className="text-4xl leading-tight font-semibold tracking-[-.05em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}
