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
        {eyebrow && <p className="mb-2 text-xs text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-xl leading-tight font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}
