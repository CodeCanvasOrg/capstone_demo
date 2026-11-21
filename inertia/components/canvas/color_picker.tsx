import { Plus } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { BRAND_COLORS, type CanvasColor } from '../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import { cn } from '@/lib/utils'

const LABELS: Record<(typeof BRAND_COLORS)[number], string> = {
  primary: 'Primary',
  accent: 'Accent',
  accentText: 'Accent text',
  text: 'Text',
  muted: 'Muted',
  background: 'Background',
  surface: 'Surface',
  white: 'White',
}

const HEX = /^#[0-9a-f]{6}$/i
const RECENT_KEY = 'canvas:recent-colors'

/** Custom colours used lately, shared by every picker on the page. */
function useRecent() {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
      return Array.isArray(saved) ? saved.filter((c) => HEX.test(c)).slice(0, 8) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === RECENT_KEY) setRecent(JSON.parse(event.newValue ?? '[]'))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const remember = (hex: string) => {
    const next = [hex, ...recent.filter((c) => c !== hex)].slice(0, 8)
    setRecent(next)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }
  return { recent, remember }
}

export const brandHex = (palette: BrandKit['palette'], c: (typeof BRAND_COLORS)[number]) =>
  c === 'white' ? '#ffffff' : palette[c as keyof BrandKit['palette']]

/**
 * Brand colours first, so pages stay on brand, then any colour: a full picker,
 * a hex field and the colours used lately. Brand picks are stored by name, so a
 * brand update restyles them; custom picks are stored as hex.
 */
export function ColorPicker({
  value,
  palette,
  onChange,
  allowNone = true,
  label,
}: {
  value: CanvasColor | undefined
  palette: BrandKit['palette']
  onChange: (next: CanvasColor | undefined) => void
  allowNone?: boolean
  label: string
}) {
  const { recent, remember } = useRecent()
  const custom = value?.startsWith('#') ? value : undefined
  const current = value
    ? value.startsWith('#')
      ? value
      : brandHex(palette, value as (typeof BRAND_COLORS)[number])
    : '#ffffff'
  const [draft, setDraft] = useState(current)
  // The hex field follows the selection until the user types in it.
  const [typing, setTyping] = useState(false)
  const shown = typing ? draft : current
  const inputId = useId()

  const pick = (next: CanvasColor | undefined) => {
    setTyping(false)
    onChange(next)
  }
  const pickHex = (hex: string) => {
    const lower = hex.toLowerCase()
    remember(lower)
    pick(lower)
  }

  const swatch = (
    key: string,
    color: string,
    name: string,
    active: boolean,
    onPick: () => void
  ) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={name}
      title={name}
      onClick={onPick}
      style={{ background: color }}
      className={cn('size-6 rounded-full border', active && 'ring-2 ring-primary ring-offset-1')}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            role="radio"
            aria-checked={value === undefined}
            aria-label="None"
            title="None"
            onClick={() => pick(undefined)}
            className={cn(
              'size-6 rounded-full border bg-[linear-gradient(135deg,transparent_45%,#dc2626_45%,#dc2626_55%,transparent_55%)]',
              value === undefined && 'ring-2 ring-primary ring-offset-1'
            )}
          />
        )}
        {BRAND_COLORS.map((c) =>
          swatch(c, brandHex(palette, c), LABELS[c], value === c, () => pick(c))
        )}
        {recent
          .filter((c) => c !== custom)
          .slice(0, 6)
          .map((c) => swatch(`r-${c}`, c, c, false, () => pickHex(c)))}
        {custom && swatch('custom', custom, custom, true, () => pickHex(custom))}
        <label
          className="relative flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed text-muted-foreground hover:text-foreground"
          title="Any colour"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          <input
            type="color"
            aria-label={`${label}: any colour`}
            className="absolute inset-0 cursor-pointer opacity-0"
            value={current}
            onChange={(event) => pickHex(event.target.value)}
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-[11px] text-muted-foreground">
          Hex
        </label>
        <input
          id={inputId}
          aria-label={`${label} hex`}
          className="h-7 w-24 rounded-md border bg-background px-2 font-mono text-xs uppercase"
          value={shown}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            setTyping(true)
            const next = event.target.value.startsWith('#')
              ? event.target.value
              : `#${event.target.value}`
            setDraft(next)
            if (HEX.test(next)) pickHex(next)
          }}
          onBlur={() => setTyping(false)}
        />
      </div>
    </div>
  )
}
