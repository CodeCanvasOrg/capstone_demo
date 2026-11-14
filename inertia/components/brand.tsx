import { Bee } from '@/components/bee/bee'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="brand-mark">
        <Bee className="size-6" />
      </span>
      {!compact && <span className="text-[.9375rem] font-semibold tracking-tight">CodeCanvas</span>}
    </div>
  )
}
