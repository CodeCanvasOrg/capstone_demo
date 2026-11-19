import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import type { ApiError } from '@/lib/api'
import { ActionFeedback } from '@/components/action_feedback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CollectionEntry } from '../../../shared/layout/collection.ts'
import {
  MAX_HIGHLIGHTS,
  PAGE_CATALOG,
  PAGE_KINDS,
  PRESETS,
  STAT_QUALIFIERS,
  STAT_QUALIFIER_LABEL,
  entryHighlights,
  parseDesign,
  planPages,
  rulesDesign,
  validateDesign,
  type PageKind,
  type PageSpec,
  type PortfolioDesign,
  type PresetId,
  type Stat,
} from '../../../shared/layout/portfolio.ts'
import { PageStrip, pageLabel, type StripPage } from './page_strip'
import type { ThumbContext } from './page_thumb'

export type BuilderEntry = Pick<CollectionEntry, 'entryId' | 'title' | 'category' | 'pages'> & {
  stats?: Stat[]
}

export type Proposal = {
  design: PortfolioDesign
  source: 'ai' | 'rules'
  notes: string
  pages: StripPage[]
}

type Props = {
  name: string
  about?: string
  entries: BuilderEntry[]
  /** The design the collection renders now. */
  design: PortfolioDesign
  approved: boolean
  busy: boolean
  error: ApiError | null
  onApply: (change: { preset: PresetId } | { design: PortfolioDesign }) => Promise<void>
  onArrange: () => Promise<Proposal | null>
}

const asEntries = (entries: BuilderEntry[]) => entries as unknown as CollectionEntry[]

const contextFor = (
  name: string,
  about: string | undefined,
  entries: BuilderEntry[],
  design: PortfolioDesign
): ThumbContext => ({
  name,
  about,
  titles: Object.fromEntries(entries.map((entry) => [entry.entryId, entry.title])),
  categories: Object.fromEntries(entries.map((entry) => [entry.entryId, entry.category])),
  order: design.pages.flatMap((page) => (page.kind === 'entry' ? [page.entryId] : [])),
})

const stripOf = (design: PortfolioDesign, entries: BuilderEntry[]): StripPage[] =>
  planPages(design, asEntries(entries)).pages.map(({ id, start, count, spec }) => ({
    id,
    start,
    count,
    spec,
  }))

const WITHDRAWS = 'Changing the design withdraws the approval of this collection.'

/** Three ways to build the same design: start from a template, edit page by page, or ask the AI. */
export function PortfolioBuilder({
  name,
  about,
  entries,
  design,
  approved,
  busy,
  error,
  onApply,
  onArrange,
}: Props) {
  const [mode, setMode] = useState('template')
  const [draft, setDraft] = useState<PortfolioDesign | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [thinking, setThinking] = useState(false)

  function startEditing(from: PortfolioDesign) {
    setDraft({ source: 'custom', pages: structuredClone(from.pages) })
    setMode('pages')
  }

  async function apply(change: { preset: PresetId } | { design: PortfolioDesign }) {
    await onApply(change)
    setDraft(null)
    setProposal(null)
  }

  async function arrange() {
    setThinking(true)
    try {
      setProposal(await onArrange())
    } finally {
      setThinking(false)
    }
  }

  return (
    <section aria-label="Portfolio design" className="space-y-4">
      <ActionFeedback error={error} busy={busy} />
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList aria-label="How to design this portfolio" className="h-auto flex-wrap">
          <TabsTrigger value="template">Start from a template</TabsTrigger>
          <TabsTrigger value="pages">Build page by page</TabsTrigger>
          <TabsTrigger value="ai">Let AI arrange it</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="pt-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Rules lay out the pages for you. Each preview shows what that template would make from
            your case studies.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PRESETS.map((preset) => {
              const made = rulesDesign(asEntries(entries), { about }, preset.id)
              const isCurrent = design.source === 'preset' && design.preset === preset.id
              return (
                <li
                  key={preset.id}
                  className="pf-preset flex flex-col gap-3 rounded-xl border p-3"
                  data-current={isCurrent}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{preset.label}</h4>
                    {isCurrent ? <Badge variant="secondary">In use</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  <PageStrip
                    size="sm"
                    label={`${preset.label} pages`}
                    pages={stripOf(made, entries).slice(0, 14)}
                    context={contextFor(name, about, entries, made)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {planPages(made, asEntries(entries)).total} pages
                  </p>
                  {!isCurrent && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-auto self-start"
                      disabled={busy}
                      onClick={() => void apply({ preset: preset.id })}
                    >
                      Use {preset.label}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {approved && <p className="mt-3 text-xs text-muted-foreground">{WITHDRAWS}</p>}
        </TabsContent>

        <TabsContent value="pages" className="pt-3">
          <PageEditor
            key={draft ? 'draft' : 'none'}
            draft={draft}
            base={design}
            name={name}
            about={about}
            entries={entries}
            busy={busy}
            approved={approved}
            onStart={() => startEditing(design)}
            onChange={setDraft}
            onDiscard={() => setDraft(null)}
            onApply={(next) => void apply({ design: next })}
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">
            The AI picks which pages to use, their layouts and the order of your case studies. It
            never writes page text: headings come from your categories, numbers from your case
            studies and the introduction from what you wrote. You decide whether to use it.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy || thinking}
            onClick={() => void arrange()}
          >
            <Sparkles aria-hidden="true" />
            {thinking ? 'Arranging…' : proposal ? 'Arrange again' : 'Arrange with AI'}
          </Button>
          <div aria-live="polite" className="space-y-3">
            {proposal && (
              <div className="pf-enter space-y-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={proposal.source === 'ai' ? 'default' : 'secondary'}>
                    {proposal.source === 'ai' ? 'Arranged by AI' : 'Arranged by rules'}
                  </Badge>
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">{proposal.notes}</p>
                </div>
                <PageStrip
                  label="Proposed pages"
                  pages={proposal.pages}
                  context={contextFor(name, about, entries, proposal.design)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void apply({ design: proposal.design })}
                  >
                    Use this arrangement
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(proposal.design)}
                  >
                    Edit it page by page
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setProposal(null)}>
                    Discard
                  </Button>
                </div>
                {approved && <p className="text-xs text-muted-foreground">{WITHDRAWS}</p>}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}

const uid = (kind: PageKind, pages: PageSpec[]) => {
  let n = pages.filter((page) => page.kind === kind).length + 1
  while (pages.some((page) => page.id === `${kind}-${n}`)) n++
  return `${kind}-${n}`
}

function blank(
  kind: Exclude<PageKind, 'entry'>,
  pages: PageSpec[],
  entries: BuilderEntry[]
): PageSpec {
  const id = PAGE_CATALOG[kind].single ? kind : uid(kind, pages)
  switch (kind) {
    case 'cover':
      return { id, kind, variant: 'ribbons' }
    case 'statement':
      return { id, kind, variant: 'panel' }
    case 'highlights': {
      const items = entryHighlights(asEntries(entries), 3)
      return {
        id,
        kind,
        variant: 'numbers',
        items: items.length ? items : [{ value: '', label: '' }],
      }
    }
    case 'section':
      return { id, kind, variant: 'bold', title: entries[0]?.category ?? '' }
    case 'contents':
      return { id, kind, variant: 'cards' }
    case 'contact':
      return { id, kind, variant: 'dark' }
  }
}

function PageEditor({
  draft,
  base,
  name,
  about,
  entries,
  busy,
  approved,
  onStart,
  onChange,
  onDiscard,
  onApply,
}: {
  draft: PortfolioDesign | null
  base: PortfolioDesign
  name: string
  about?: string
  entries: BuilderEntry[]
  busy: boolean
  approved: boolean
  onStart: () => void
  onChange: (next: PortfolioDesign) => void
  onDiscard: () => void
  onApply: (next: PortfolioDesign) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  if (!draft)
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Add, remove and reorder pages, pick a layout for each and write your own headings. Your
          edits stay here until you apply them.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onStart}>
          Start from the current pages
        </Button>
      </div>
    )

  const { pages } = draft
  const set = (next: PageSpec[]) => onChange({ ...draft, pages: next })
  const patch = (id: string, change: Record<string, unknown>) =>
    set(pages.map((page) => (page.id === id ? ({ ...page, ...change } as PageSpec) : page)))
  const findings = [
    ...(() => {
      const parsed = parseDesign(draft)
      return parsed.ok ? [] : parsed.errors
    })(),
    ...validateDesign(draft, asEntries(entries), { about }),
  ]
  const context = contextFor(name, about, entries, draft)
  const strip = stripOf(draft, entries)
  const first = pages[0]?.kind === 'cover' ? 1 : 0
  const last = pages.at(-1)?.kind === 'contact' ? pages.length - 2 : pages.length - 1
  const chosen = pages.find((page) => page.id === selected)

  const move = (index: number, by: -1 | 1) => {
    const to = index + by
    if (to < first || to > last) return
    const next = [...pages]
    ;[next[index], next[to]] = [next[to], next[index]]
    set(next)
  }
  const add = (kind: Exclude<PageKind, 'entry'>) => {
    const page = blank(kind, pages, entries)
    const next = [...pages]
    if (kind === 'cover') next.unshift(page)
    else if (kind === 'contact') next.push(page)
    else {
      // After the selected page when there is one; otherwise where the kind normally belongs.
      const after = (kinds: PageKind[]) =>
        next.reduce((at, item, index) => (kinds.includes(item.kind) ? index + 1 : at), 0)
      const firstEntry = next.findIndex((item) => item.kind === 'entry')
      const at = selected
        ? next.findIndex((item) => item.id === selected) + 1
        : kind === 'statement'
          ? after(['cover'])
          : kind === 'highlights'
            ? after(['cover', 'statement'])
            : kind === 'contents'
              ? after(['cover', 'statement', 'highlights'])
              : firstEntry >= 0
                ? firstEntry
                : last + 1
      next.splice(Math.min(Math.max(at, first), last + 1), 0, page)
    }
    set(next)
    setSelected(page.id)
  }
  const available = PAGE_KINDS.filter(
    (kind): kind is Exclude<PageKind, 'entry'> =>
      kind !== 'entry' && !(PAGE_CATALOG[kind].single && pages.some((page) => page.kind === kind))
  )

  return (
    <div className="space-y-4">
      <PageStrip
        label="Pages being edited"
        pages={strip}
        context={context}
        selectedId={selected}
        onSelect={setSelected}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,18rem)]">
        <ol aria-label="Page order" className="divide-y rounded-xl border">
          {pages.map((page, index) => (
            <li key={page.id} className="pf-enter flex items-center gap-1 px-2 py-1.5 text-sm">
              <button
                type="button"
                aria-pressed={selected === page.id}
                className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left hover:bg-muted aria-pressed:bg-muted aria-pressed:font-semibold"
                onClick={() => setSelected(page.id)}
              >
                {pageLabel(page, context)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {PAGE_CATALOG[page.kind].label}
                </span>
              </button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${pageLabel(page, context)} up`}
                disabled={
                  busy || index <= first || page.kind === 'cover' || page.kind === 'contact'
                }
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move ${pageLabel(page, context)} down`}
                disabled={busy || index >= last || page.kind === 'cover' || page.kind === 'contact'}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${pageLabel(page, context)} page`}
                title={
                  page.kind === 'entry'
                    ? 'To leave a case study out, remove it from the collection'
                    : undefined
                }
                disabled={busy || page.kind === 'entry'}
                onClick={() => {
                  set(pages.filter((item) => item.id !== page.id))
                  if (selected === page.id) setSelected(null)
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>

        <div className="space-y-3">
          {chosen ? (
            <PageFields
              page={chosen}
              entries={entries}
              onChange={(change) => patch(chosen.id, change)}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a page to change its layout and text.
            </p>
          )}
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2" disabled={busy}>
        <legend className="mb-1 text-xs font-medium">Add a page</legend>
        {available.map((kind) => (
          <Button key={kind} type="button" size="xs" variant="outline" onClick={() => add(kind)}>
            <Plus aria-hidden="true" />
            {PAGE_CATALOG[kind].label}
          </Button>
        ))}
      </fieldset>

      {findings.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-destructive">
          {findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`} className="flex items-start gap-1.5">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {finding.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || findings.length > 0}
          onClick={() => onApply({ ...draft, source: 'custom' })}
        >
          Apply this design
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
          Discard edits
        </Button>
        {approved && <p className="text-xs text-muted-foreground">{WITHDRAWS}</p>}
        {draft.source === 'custom' && base.source !== 'custom' && (
          <p className="text-xs text-muted-foreground">
            Applying turns off automatic updates from the template. New case studies are added
            before the contact page.
          </p>
        )}
      </div>
    </div>
  )
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="xs"
          variant={value === option.id ? 'default' : 'outline'}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function PageFields({
  page,
  entries,
  onChange,
}: {
  page: PageSpec
  entries: BuilderEntry[]
  onChange: (change: Record<string, unknown>) => void
}) {
  const info = PAGE_CATALOG[page.kind]
  const id = `pf-${page.id}`
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div>
        <h4 className="text-sm font-semibold">{info.label}</h4>
        <p className="text-xs text-muted-foreground">{info.description}</p>
      </div>
      {'variant' in page && info.variants.length > 0 && (
        <Segmented
          label={`${info.label} layout`}
          value={page.variant}
          options={info.variants}
          onChange={(variant) => onChange({ variant })}
        />
      )}
      {page.kind === 'cover' && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-sub`}>Line under the title</Label>
          <Input
            id={`${id}-sub`}
            value={page.subtitle ?? ''}
            maxLength={120}
            placeholder={`${entries.length} case ${entries.length === 1 ? 'study' : 'studies'}`}
            onChange={(event) => onChange({ subtitle: event.target.value || undefined })}
          />
        </div>
      )}
      {page.kind === 'statement' && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-text`}>Text for this page</Label>
          <Textarea
            id={`${id}-text`}
            value={page.text ?? ''}
            maxLength={1200}
            placeholder="Leave empty to use the company introduction"
            onChange={(event) => onChange({ text: event.target.value || undefined })}
          />
        </div>
      )}
      {page.kind === 'section' && (
        <>
          <div className="space-y-1">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
              value={page.title}
              maxLength={80}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-text`}>Line under the title (optional)</Label>
            <Input
              id={`${id}-text`}
              value={page.text ?? ''}
              maxLength={240}
              onChange={(event) => onChange({ text: event.target.value || undefined })}
            />
          </div>
        </>
      )}
      {page.kind === 'contact' && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-text`}>Closing line (optional)</Label>
          <Input
            id={`${id}-text`}
            value={page.text ?? ''}
            maxLength={240}
            onChange={(event) => onChange({ text: event.target.value || undefined })}
          />
        </div>
      )}
      {page.kind === 'highlights' && (
        <div className="space-y-3">
          {page.items.map((item, index) => {
            const set = (change: Partial<Stat>) =>
              onChange({
                items: page.items.map((entry, at) =>
                  at === index ? { ...entry, ...change } : entry
                ),
              })
            return (
              <fieldset key={index} className="space-y-1.5 rounded-lg bg-muted/50 p-2">
                <legend className="sr-only">Figure {index + 1}</legend>
                <div className="flex gap-2">
                  <Input
                    aria-label={`Figure ${index + 1} value`}
                    value={item.value}
                    maxLength={16}
                    placeholder="40%"
                    className="w-24"
                    onChange={(event) => set({ value: event.target.value })}
                  />
                  <Input
                    aria-label={`Figure ${index + 1} label`}
                    value={item.label}
                    maxLength={60}
                    placeholder="faster document review"
                    onChange={(event) => set({ label: event.target.value })}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove figure ${index + 1}`}
                    disabled={page.items.length === 1}
                    onClick={() => onChange({ items: page.items.filter((_, at) => at !== index) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <select
                  aria-label={`Figure ${index + 1} basis`}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                  value={item.qualifier ?? ''}
                  onChange={(event) =>
                    set({ qualifier: (event.target.value || undefined) as Stat['qualifier'] })
                  }
                >
                  <option value="">No basis shown</option>
                  {STAT_QUALIFIERS.map((value) => (
                    <option key={value} value={value}>
                      {STAT_QUALIFIER_LABEL[value]}
                    </option>
                  ))}
                </select>
              </fieldset>
            )
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={page.items.length >= MAX_HIGHLIGHTS}
              onClick={() => onChange({ items: [...page.items, { value: '', label: '' }] })}
            >
              <Plus aria-hidden="true" />
              Add a figure
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                const items = entryHighlights(asEntries(entries), 3)
                if (items.length) onChange({ items })
              }}
            >
              Use figures from case studies
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Figures you type are shown as written. Figures from case studies keep their basis.
          </p>
        </div>
      )}
      {page.kind === 'entry' && (
        <p className="text-xs text-muted-foreground">
          This page uses the case study&apos;s own layout and length. Change the layout on the case
          study.
        </p>
      )}
    </div>
  )
}
