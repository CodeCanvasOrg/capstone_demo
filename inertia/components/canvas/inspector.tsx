import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  type Bold,
  CaseUpper,
  Crosshair,
  ImageOff,
  Italic,
  Lock,
  Pencil,
  Scaling,
  Unlock,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clampGeo } from '../../../shared/canvas/geometry.ts'
import { fitToImage } from '../../../shared/canvas/ops.ts'
import {
  BORDER_STYLES,
  FONT_FAMILIES,
  FONT_SCALE,
  FONT_WEIGHTS,
  QUALIFIERS,
  type FontFamily,
  type Frame,
  type FrameKind,
  type FrameStyle,
  type Geo,
  type Sheet,
} from '../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import { ColorPicker } from './color_picker'
import { FocalPoint } from './focal_point'
import { ImageLibrary } from './image_library'
import { useDocumentImages, type DocumentImageInfo } from './images'
import type { CanvasEditor } from './grapes/create_editor'
import { cvOf } from './grapes/create_editor'

type BorderStyle = (typeof BORDER_STYLES)[number]
const KIND_LABELS: Record<FrameKind, string> = {
  text: 'Text box',
  figure: 'Big number',
  image: 'Image',
  shape: 'Shape',
  art: 'Artwork',
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
  const { images } = useDocumentImages({ workspaceId, documentId })
  const image = images.find((i) => i.id === frame.imageId) ?? null
  const size = image?.width && image.height ? { width: image.width, height: image.height } : null
  const pick = (picked: DocumentImageInfo) =>
    onChange({
      ...frame,
      imageId: picked.id,
      // A new picture starts centred; its file name is a first description.
      focus: picked.id === frame.imageId ? frame.focus : undefined,
      alt: frame.alt || picked.filename.replace(/\.\w+$/, ''),
    })
  return (
    <div className="flex flex-col gap-3">
      <ImageLibrary
        workspaceId={workspaceId}
        documentId={documentId}
        selectedId={frame.imageId}
        onPick={pick}
      />
      {frame.imageId && (
        <>
          {frame.fit === 'cover' && image && (
            <Field label="Focal point (kept in view when cropped)">
              <FocalPoint
                src={`${image.src}?variant=thumb`}
                alt={frame.alt}
                focus={frame.focus ?? { x: 50, y: 50 }}
                onChange={(focus) => onChange({ ...frame, focus })}
              />
            </Field>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!size}
              title={size ? undefined : 'The size of this image is not known'}
              onClick={() => size && onChange({ ...frame, geo: fitToImage(frame.geo, size) })}
            >
              <Scaling aria-hidden="true" /> Fit box to picture
            </Button>
            {frame.focus && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onChange({ ...frame, focus: undefined })}
              >
                <Crosshair aria-hidden="true" /> Centre
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange({ ...frame, imageId: null, focus: undefined })}
            >
              <ImageOff aria-hidden="true" /> Remove picture
            </Button>
          </div>
        </>
      )}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** A number input that clamps and rounds; empty means "not set". */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
}: {
  label: string
  value: number | undefined
  onChange: (next: number | undefined) => void
  min: number
  max: number
  step?: number
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(event) => {
          if (event.target.value === '') return onChange(undefined)
          const n = Number(event.target.value)
          if (!Number.isFinite(n)) return
          onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)))
        }}
      />
    </Field>
  )
}

function Toggle({
  label,
  icon: Icon,
  pressed,
  onChange,
}: {
  label: string
  icon: typeof Bold
  pressed: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={pressed ? 'secondary' : 'outline'}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={() => onChange(!pressed)}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

const ALIGNS = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
] as const
const VALIGNS = [
  { value: 'top', label: 'Top', icon: AlignVerticalJustifyStart },
  { value: 'middle', label: 'Middle', icon: AlignVerticalJustifyCenter },
  { value: 'bottom', label: 'Bottom', icon: AlignVerticalJustifyEnd },
] as const
const FAMILY_LABELS: Record<FontFamily, string> = {
  brand: 'Brand font',
  sans: 'Sans serif',
  serif: 'Serif',
  mono: 'Monospace',
}
const WEIGHT_LABELS: Record<(typeof FONT_WEIGHTS)[number], string> = {
  400: 'Regular',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra bold',
}
const SIZE_PRESETS = [7, 8, 9, 9.5, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80]

/** Typography of a text or number box. */
function TextFields({
  frame,
  palette,
  style,
}: {
  frame: Extract<Frame, { kind: 'text' | 'figure' }>
  palette: BrandKit['palette']
  style: (patch: Partial<FrameStyle>) => void
}) {
  const s = frame.style
  const fallback = frame.kind === 'figure' ? FONT_SCALE.display : FONT_SCALE.md
  const size = s.size ?? (s.font ? FONT_SCALE[s.font] : undefined)
  return (
    <>
      <Field label="Font">
        <select
          className={select}
          value={s.family ?? 'brand'}
          onChange={(e) => style({ family: e.target.value as FontFamily })}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {FAMILY_LABELS[f]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (pt)">
          <Input
            type="number"
            inputMode="decimal"
            min={5}
            max={200}
            step={0.5}
            list="cv-size-presets"
            placeholder={String(fallback)}
            value={size ?? ''}
            onChange={(e) => {
              if (e.target.value === '') return style({ size: undefined, font: undefined })
              const n = Number(e.target.value)
              if (Number.isFinite(n))
                style({ size: Math.min(200, Math.max(5, Math.round(n * 2) / 2)), font: undefined })
            }}
          />
          <datalist id="cv-size-presets">
            {SIZE_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Weight">
          <select
            className={select}
            value={s.weight ?? ''}
            onChange={(e) =>
              style({
                weight: e.target.value
                  ? (Number(e.target.value) as (typeof FONT_WEIGHTS)[number])
                  : undefined,
              })
            }
          >
            <option value="">Default</option>
            {FONT_WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {WEIGHT_LABELS[w]}
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Line height (%)"
          value={s.lineHeight}
          placeholder={frame.kind === 'figure' ? '100' : '145'}
          min={80}
          max={300}
          step={5}
          onChange={(lineHeight) => style({ lineHeight })}
        />
        <NumberField
          label="Letter spacing"
          value={s.tracking}
          placeholder="0"
          min={-100}
          max={500}
          step={10}
          onChange={(tracking) => style({ tracking: tracking || undefined })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Toggle
          label="Italic"
          icon={Italic}
          pressed={!!s.italic}
          onChange={(v) => style({ italic: v || undefined })}
        />
        <Toggle
          label="Capitals"
          icon={CaseUpper}
          pressed={!!s.caps}
          onChange={(v) => style({ caps: v || undefined })}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {ALIGNS.map((a) => (
          <Toggle
            key={a.value}
            label={a.label}
            icon={a.icon}
            pressed={(s.align ?? 'left') === a.value}
            onChange={() => style({ align: a.value })}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {VALIGNS.map((a) => (
          <Toggle
            key={a.value}
            label={a.label}
            icon={a.icon}
            pressed={(s.valign ?? 'top') === a.value}
            onChange={() => style({ valign: a.value })}
          />
        ))}
      </div>
      <Field label="Text colour">
        <ColorPicker
          label="Text colour"
          value={s.color}
          palette={palette}
          onChange={(color) => style({ color })}
        />
      </Field>
    </>
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
  // Applied to the frame as it is now, so a stale copy here can never undo other edits.
  const style = (patch: Partial<FrameStyle>) => {
    if (cmp && ed) ed.updateFrame(cmp, (cur) => ({ ...cur, style: { ...cur.style, ...patch } }))
  }

  if (!frame) {
    const sheetCmp = sheetId ? ed?.sheets().find((c) => c.getId() === sheetId) : null
    if (!sheetCmp)
      return <p className="text-sm text-muted-foreground">Select a page or a box to change it.</p>
    const sheet = cvOf<Pick<Sheet, 'id' | 'background'>>(sheetCmp)
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Page</h2>
        <Field label="Background">
          <ColorPicker
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
          variant={sheet.background === 'gradient' ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={sheet.background === 'gradient'}
          onClick={() => ed!.updateSheet(sheetCmp, (s) => ({ ...s, background: 'gradient' }))}
        >
          Use the brand gradient
        </Button>
      </div>
    )
  }

  const locked = !!frame.locked
  const s = frame.style
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{KIND_LABELS[frame.kind]}</h2>
        <div className="flex items-center gap-1">
          {frame.kind === 'text' && !locked && (
            <Button type="button" variant="outline" size="xs" onClick={() => ed?.editSelected()}>
              <Pencil aria-hidden="true" /> Edit text
            </Button>
          )}
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
      </div>
      <fieldset disabled={locked} className="flex flex-col gap-4 disabled:opacity-60">
        <Section title="Position">
          <GeoFields geo={frame.geo} onChange={(geo) => update({ ...frame, geo })} />
        </Section>

        {frame.kind === 'figure' && (
          <Section title="Number">
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
          </Section>
        )}

        {frame.kind === 'image' && (
          <Section title="Image">
            <ImageFields
              frame={frame}
              workspaceId={workspaceId}
              documentId={documentId}
              onChange={update}
            />
          </Section>
        )}

        {frame.kind === 'shape' && (
          <Section title="Shape">
            <select
              aria-label="Shape"
              className={select}
              value={frame.shape}
              onChange={(e) => update({ ...frame, shape: e.target.value as typeof frame.shape })}
            >
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="hex">Hexagon</option>
              <option value="line">Line</option>
            </select>
          </Section>
        )}

        {frame.kind === 'art' && (
          <Section title="Artwork">
            <select
              aria-label="Artwork"
              className={select}
              value={frame.art}
              onChange={(e) => update({ ...frame, art: e.target.value as typeof frame.art })}
            >
              <option value="glow">Glow</option>
              <option value="ribbons">Ribbons</option>
            </select>
          </Section>
        )}

        {(frame.kind === 'text' || frame.kind === 'figure') && (
          <Section title="Text">
            <TextFields frame={frame} palette={palette} style={style} />
          </Section>
        )}

        {frame.kind !== 'art' && (
          <Section title="Fill">
            <ColorPicker
              label="Fill colour"
              value={s.fill}
              palette={palette}
              onChange={(fill) => style({ fill })}
            />
            {s.fill && (
              <NumberField
                label="Fill strength (%)"
                value={s.fillAlpha ?? 100}
                min={0}
                max={100}
                step={5}
                onChange={(fillAlpha) =>
                  style({ fillAlpha: fillAlpha === 100 ? undefined : fillAlpha })
                }
              />
            )}
          </Section>
        )}

        {frame.kind !== 'art' && (
          <Section title="Border">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Border width (mm)"
                value={s.border ? s.border.width / 10 : undefined}
                placeholder="None"
                min={0}
                max={5}
                step={0.1}
                onChange={(width) =>
                  style({
                    border: width
                      ? {
                          width: Math.max(1, Math.round(width * 10)),
                          color: s.border?.color ?? 'primary',
                          style: s.border?.style ?? 'solid',
                        }
                      : undefined,
                  })
                }
              />
              <Field label="Style">
                <select
                  className={select}
                  disabled={!s.border}
                  value={s.border?.style ?? 'solid'}
                  onChange={(e) =>
                    s.border &&
                    style({
                      border: { ...s.border, style: e.target.value as BorderStyle },
                    })
                  }
                >
                  {BORDER_STYLES.map((b) => (
                    <option key={b} value={b}>
                      {b[0].toUpperCase() + b.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {s.border && (
              <ColorPicker
                label="Border colour"
                value={s.border.color}
                palette={palette}
                allowNone={false}
                onChange={(color) => color && s.border && style({ border: { ...s.border, color } })}
              />
            )}
          </Section>
        )}

        <Section title="Box">
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Padding (mm)"
              value={(s.padding ?? 0) / 10}
              min={0}
              max={40}
              step={0.5}
              onChange={(v) => style({ padding: v ? Math.round(v * 10) : undefined })}
            />
            <NumberField
              label="Corners (mm)"
              value={(s.radius ?? 0) / 10}
              min={0}
              max={50}
              step={0.5}
              onChange={(v) => style({ radius: v ? Math.round(v * 10) : undefined })}
            />
            <NumberField
              label="Opacity (%)"
              value={s.opacity ?? 100}
              min={0}
              max={100}
              step={5}
              onChange={(v) => style({ opacity: v === 100 ? undefined : v })}
            />
          </div>
          <Field label="Shadow">
            <select
              className={select}
              value={s.shadow ?? ''}
              onChange={(e) =>
                style({ shadow: (e.target.value || undefined) as FrameStyle['shadow'] })
              }
            >
              <option value="">None</option>
              <option value="sm">Soft</option>
              <option value="md">Medium</option>
              <option value="lg">Strong</option>
            </select>
          </Field>
          <NumberField
            label="Reading order"
            value={frame.order}
            min={0}
            max={999}
            onChange={(order) => update({ ...frame, order: order ?? 0 })}
          />
        </Section>
      </fieldset>
    </div>
  )
}
