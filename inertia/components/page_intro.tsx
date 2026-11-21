import type { ReactNode } from 'react'
export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        <span aria-hidden="true" className="page-bar" />
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title text-3xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}
