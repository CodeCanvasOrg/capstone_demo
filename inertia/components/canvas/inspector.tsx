import { Lock, Unlock, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { urlFor } from '@/client'
import { api, feedbackError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clampGeo } from '../../../shared/canvas/geometry.ts'
import {
  BRAND_COLORS,
  FONT_SCALE,
  QUALIFIERS,
  type CanvasColor,
  type FontScale,
  type Frame,
  type FrameStyle,
  type Geo,
  type Sheet,
} from '../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { CanvasEditor } from './grapes/create_editor'
import { cvOf } from './grapes/create_editor'

const LABELS: Record<string, string> = {
  primary: 'Primary',
  accent: 'Accent',
  accentText: 'Accent text',
  text: 'Text',
  muted: 'Muted',
  background: 'Background',
  surface: 'Surface',
  white: 'White',
}
const QUALIFIER_LABELS: Record<(typeof QUALIFIERS)[number], string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const select = 'h-8 rounded-md border bg-background px-2 text-xs'

/** Brand colours only (plus none), so pages stay on brand. */
function Swatches({
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
  const hex = (c: (typeof BRAND_COLORS)[number]) =>
    c === 'white' ? '#ffffff' : palette[c as keyof typeof palette]
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={value === undefined}
          aria-label="None"
          onClick={() => onChange(undefined)}
          className={`size-6 rounded-full border bg-[linear-gradient(135deg,transparent_45%,#dc2626_45%,#dc2626_55%,transparent_55%)] ${value === undefined ? 'ring-2 ring-primary ring-offset-1' : ''}`}
        />
      )}
      {BRAND_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={LABELS[c]}
          title={LABELS[c]}
          onClick={() => onChange(c)}
          style={{ background: hex(c) }}
          className={`size-6 rounded-full border ${value === c ? 'ring-2 ring-primary ring-offset-1' : ''}`}
        />
      ))}
    </div>
  )
}

/** Millimetres in the inputs; tenths of a millimetre stored. */
function GeoFields({ geo, onChange }: { geo: Geo; onChange: (next: Geo) => void }) {
  const field = (key: keyof Geo, label: string) => (
    <Field label={label}>
      <Input
        type="number"
        step={0.5}
        inputMode="decimal"
        value={geo[key] / 10}
        onChange={(event) => {
          const mm = Number(event.target.value)
          if (Number.isFinite(mm)) onChange(clampGeo({ ...geo, [key]: Math.round(mm * 10) }))
        }}
      />
    </Field>
  )
  return (
    <div className="grid grid-cols-2 gap-2">
      {field('x', 'X (mm)')}
      {field('y', 'Y (mm)')}
      {field('w', 'Width (mm)')}
      {field('h', 'Height (mm)')}
    </div>
  )
}

function ImageFields({
  frame,
  workspaceId,
  documentId,
  onChange,
}: {
  frame: Extract<Frame, { kind: 'image' }>
  workspaceId: string
  documentId: string
  onChange: (next: Frame) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const data = new FormData()
      data.append('file', file)
      const res = await api<{ data: { id: string } }>(
        urlFor('documentImages.store', { workspaceId, documentId }),
        'POST',
        data
      )
      onChange({
        ...frame,
        imageId: res.data.id,
        alt: frame.alt || file.name.replace(/\.\w+$/, ''),
      })
    } catch (err) {
      setError(feedbackError(err).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden="true" /> {frame.imageId ? 'Replace image' : 'Upload image'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Field label="Description (alt text)">
        <Input
          value={frame.alt}
          maxLength={300}
          onChange={(e) => onChange({ ...frame, alt: e.target.value })}
        />
      </Field>
      <Field label="Fit">
        <select
          className={select}
          value={frame.fit}
          onChange={(e) => onChange({ ...frame, fit: e.target.value as 'cover' | 'contain' })}
        >
          <option value="cover">Fill the box</option>
          <option value="contain">Show it all</option>
        </select>
      </Field>
    </div>
  )
}

/** Properties of the selected frame, or of the selected page when no frame is. */
export function Inspector({
  canvasEditor,
  frame,
  sheetId,
  palette,
  workspaceId,
  documentId,
}: {
  canvasEditor: CanvasEditor | null
  frame: Frame | null
  sheetId: string | null
  palette: BrandKit['palette']
  workspaceId: string
  documentId: string
}) {
  const ed = canvasEditor
  const cmp = frame && ed ? ed.selected() : null
  const update = (next: Frame) => {
    if (cmp && ed) ed.updateFrame(cmp, () => next)
  }
  const style = (patch: Partial<FrameStyle>) =>
    frame && update({ ...frame, style: { ...frame.style, ...patch } })

  if (!frame) {
    const sheetCmp = sheetId ? ed?.sheets().find((c) => c.getId() === sheetId) : null
    if (!sheetCmp)
      return <p className="text-sm text-muted-foreground">Select a page or a box to change it.</p>
    const sheet = cvOf<Pick<Sheet, 'id' | 'background'>>(sheetCmp)
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Page</h2>
        <Field label="Background">
          <Swatches
            label="Page background"
            value={sheet.background === 'gradient' ? undefined : sheet.background}
            palette={palette}
            allowNone={false}
            onChange={(next) =>
              ed!.updateSheet(sheetCmp, (s) => ({ ...s, background: next ?? 'white' }))
            }
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ed!.updateSheet(sheetCmp, (s) => ({ ...s, background: 'gradient' }))}
        >
          Use the brand gradient
        </Button>
      </div>
    )
  }

  const locked = !!frame.locked
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize">
          {frame.kind === 'figure' ? 'Big number' : frame.kind}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => update({ ...frame, locked: !locked })}
          aria-pressed={locked}
        >
          {locked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}{' '}
          {locked ? 'Locked' : 'Lock'}
        </Button>
      </div>
      <fieldset disabled={locked} className="flex flex-col gap-4 disabled:opacity-60">
        <GeoFields geo={frame.geo} onChange={(geo) => update({ ...frame, geo })} />

        {frame.kind === 'figure' && (
          <>
            <Field label="Number">
              <Input
                value={frame.value}
                maxLength={12}
                onChange={(e) => update({ ...frame, value: e.target.value })}
              />
            </Field>
            <Field label="What it measures">
              <Input
                value={frame.label}
                maxLength={200}
                onChange={(e) => update({ ...frame, label: e.target.value })}
              />
            </Field>
            <Field label="Evidence">
              <select
                className={select}
                value={frame.qualifier ?? ''}
                onChange={(e) =>
                  update({
                    ...frame,
                    qualifier: (e.target.value || undefined) as
                      (typeof QUALIFIERS)[number] | undefined,
                  })
                }
              >
                <option value="">Not stated</option>
                {QUALIFIERS.map((q) => (
                  <option key={q} value={q}>
                    {QUALIFIER_LABELS[q]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {frame.kind === 'image' && (
          <ImageFields
            frame={frame}
            workspaceId={workspaceId}
            documentId={documentId}
            onChange={update}
          />
        )}

        {frame.kind === 'shape' && (
          <Field label="Shape">
            <select
              className={select}
              value={frame.shape}
              onChange={(e) => update({ ...frame, shape: e.target.value as typeof frame.shape })}
            >
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="hex">Hexagon</option>
              <option value="line">Line</option>
            </select>
          </Field>
        )}

        {frame.kind === 'art' && (
          <Field label="Artwork">
            <select
              className={select}
              value={frame.art}
              onChange={(e) => update({ ...frame, art: e.target.value as typeof frame.art })}
            >
              <option value="glow">Glow</option>
              <option value="ribbons">Ribbons</option>
            </select>
          </Field>
        )}

        {frame.kind !== 'art' && (
          <Field label="Fill">
            <Swatches
              label="Fill colour"
              value={frame.style.fill}
              palette={palette}
              onChange={(fill) => style({ fill })}
            />
          </Field>
        )}

        {(frame.kind === 'text' || frame.kind === 'figure') && (
          <>
            <Field label="Text colour">
              <Swatches
                label="Text colour"
                value={frame.style.color}
                palette={palette}
                onChange={(color) => style({ color })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Size">
                <select
                  className={select}
                  value={frame.style.font ?? ''}
                  onChange={(e) =>
                    style({ font: (e.target.value || undefined) as FontScale | undefined })
                  }
                >
                  <option value="">Default</option>
                  {(Object.keys(FONT_SCALE) as FontScale[]).map((f) => (
                    <option key={f} value={f}>
                      {FONT_SCALE[f]} pt
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Weight">
                <select
                  className={select}
                  value={frame.style.weight ?? ''}
                  onChange={(e) =>
                    style({
                      weight: e.target.value
                        ? (Number(e.target.value) as 400 | 600 | 800)
                        : undefined,
                    })
                  }
                >
                  <option value="">Default</option>
                  <option value="400">Regular</option>
                  <option value="600">Semibold</option>
                  <option value="800">Bold</option>
                </select>
              </Field>
              <Field label="Align">
                <select
                  className={select}
                  value={frame.style.align ?? 'left'}
                  onChange={(e) => style({ align: e.target.value as 'left' | 'center' | 'right' })}
                >
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </select>
              </Field>
              <Field label="Vertical">
                <select
                  className={select}
                  value={frame.style.valign ?? 'top'}
                  onChange={(e) => style({ valign: e.target.value as 'top' | 'middle' | 'bottom' })}
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Field label="Padding (mm)">
            <Input
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={(frame.style.padding ?? 0) / 10}
              onChange={(e) =>
                style({
                  padding: Math.min(400, Math.max(0, Math.round(Number(e.target.value) * 10))),
                })
              }
            />
          </Field>
          <Field label="Corners (mm)">
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={(frame.style.radius ?? 0) / 10}
              onChange={(e) =>
                style({
                  radius: Math.min(500, Math.max(0, Math.round(Number(e.target.value) * 10))),
                })
              }
            />
          </Field>
          <Field label="Opacity (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={frame.style.opacity ?? 100}
              onChange={(e) =>
                style({ opacity: Math.min(100, Math.max(0, Math.round(Number(e.target.value)))) })
              }
            />
          </Field>
        </div>

        <Field label="Reading order">
          <Input
            type="number"
            min={0}
            max={999}
            value={frame.order}
            onChange={(e) =>
              update({
                ...frame,
                order: Math.min(999, Math.max(0, Math.round(Number(e.target.value)))),
              })
            }
          />
        </Field>
      </fieldset>
    </div>
  )
}
