import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </header>
  )
}

export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-8 last:mb-0', className)}>
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y rounded-xl border bg-card">{children}</div>
    </section>
  )
}

export function SettingRow({
  title,
  description,
  htmlFor,
  children,
  disabled,
}: {
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        disabled && 'opacity-60'
      )}
    >
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {title}
        </label>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  title: string
  description?: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <SettingRow title={title} description={description} htmlFor={id} disabled={disabled}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </SettingRow>
  )
}

export function SelectRow<T extends string>({
  id,
  title,
  description,
  value,
  options,
  onChange,
  className,
}: {
  id: string
  title: string
  description?: ReactNode
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <SettingRow title={title} description={description} htmlFor={id}>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} className={cn('w-full sm:w-52', className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
            value === option.value && 'bg-muted text-foreground shadow-xs'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function FieldMessage({ children }: { children?: string }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1.5 text-xs text-destructive">
      {children}
    </p>
  )
}
