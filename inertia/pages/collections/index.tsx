import { useCallback, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  TriangleAlert,
  X,
} from 'lucide-react'
import { urlFor } from '@/client'
import { api, feedbackError, type ApiError } from '@/lib/api'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { ActionFeedback } from '@/components/action_feedback'
import { PageStrip, type StripPage } from '@/components/portfolio/page_strip'
import { PortfolioBuilder, type BuilderEntry, type Proposal } from '@/components/portfolio/builder'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PRESETS, type PortfolioDesign, type PresetId } from '../../../shared/layout/portfolio.ts'

type Doc = { id: string; title: string }
type Summary = { id: string; name: string; status: string }
type Entry = BuilderEntry & { templateId: string }
type Detail = {
  id: string
  name: string
  status: string
  manifestHash: string
  manifest: { wrapper: { about?: string }; entries: Entry[]; design?: PortfolioDesign }
  budget: {
    wrapperPages: number
    contentsPages: number
    entryPages: number
    total: number
    over: boolean
    overBy: number
    error?: string
    suggestions: (
      | { kind: 'use_concise'; resultingTotal: number }
      | { kind: 'remove_entries'; count: number; resultingTotal: number }
    )[]
  }
  contents: {
    rows: { entryId: string; title: string; category: string; page: number }[]
    converged: boolean
  }
  pagePlan: {
    design: PortfolioDesign
    total: number
    pages: StripPage[]
    findings: { code: string; message: string }[]
  }
  state: { approval: 'none' | 'current' | 'stale'; staleEntries: string[] }
}

const DEFAULT_TARGET = 20

/** Design, budget and approve a portfolio. Entries are pinned revisions; the design is part of what an approval covers. */
export default function Index({
  collections,
  documents,
}: {
  collections: Summary[]
  documents: Doc[]
}) {
  const workspaceId = useWorkspaceId()
  const [list, setList] = useState(collections)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [preset, setPreset] = useState<PresetId>('brochure')
  const [chosen, setChosen] = useState<string[]>([])

  const load = useCallback(
    async (id: string, nextTarget: number) => {
      try {
        const body = await api<{ data: Detail }>(
          `${urlFor('collections.show', { workspaceId, collectionId: id })}?target=${nextTarget}`
        )
        setDetail(body.data)
        setSelected(id)
      } catch (reason) {
        setError(feedbackError(reason))
      }
    },
    [workspaceId]
  )

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (reason) {
      setError(feedbackError(reason))
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      const body = await api<{ data: Detail }>(
        urlFor('collections.store', { workspaceId }),
        'POST',
        {
          name,
          entryIds: chosen,
          wrapper: about.trim() ? { about: about.trim() } : {},
          preset,
        }
      )
      setList((current) => [
        { id: body.data.id, name: body.data.name, status: body.data.status },
        ...current,
      ])
      setName('')
      setAbout('')
      setChosen([])
      await load(body.data.id, target)
    })

  const update = (changes: Record<string, unknown>) =>
    run(async () => {
      await api(urlFor('collections.update', { workspaceId, collectionId: detail!.id }), 'PATCH', {
        ...changes,
        baseHash: detail!.manifestHash,
      })
      await load(detail!.id, target)
    })

  /** A proposal changes nothing until the reviewer applies it. */
  async function arrange(): Promise<Proposal | null> {
    setBusy(true)
    setError(null)
    try {
      const body = await api<{ data: Proposal }>(
        urlFor('collections.arrange', { workspaceId, collectionId: detail!.id }),
        'POST',
        { target }
      )
      return body.data
    } catch (reason) {
      setError(feedbackError(reason))
      return null
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = detail!.manifest.entries.map((entry) => entry.entryId)
    const swap = index + by
    if (swap < 0 || swap >= ids.length) return
    ;[ids[index], ids[swap]] = [ids[swap], ids[index]]
    void update({ entryIds: ids })
  }

  const approve = () =>
    run(async () => {
      await api(urlFor('collections.approve', { workspaceId, collectionId: detail!.id }), 'POST', {
        baseHash: detail!.manifestHash,
      })
      await load(detail!.id, target)
    })

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )

  const thumbs = useMemo(
    () =>
      detail && {
        name: detail.name,
        about: detail.manifest.wrapper.about,
        titles: Object.fromEntries(detail.manifest.entries.map((e) => [e.entryId, e.title])),
        categories: Object.fromEntries(detail.manifest.entries.map((e) => [e.entryId, e.category])),
        order: detail.contents.rows.map((row) => row.entryId),
      },
    [detail]
  )
  // Rules and presets decide entry order; only a custom or AI design keeps it in the page order.
  const orderedByDesign =
    detail?.pagePlan.design.source === 'custom' || detail?.pagePlan.design.source === 'ai'

  return (
    <div className="minimal-page">
      <Head title="Collections" />
      <header>
        <h1 className="text-lg font-semibold">Collections</h1>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          Turn saved case studies into one portfolio. Start from a template, arrange the pages
          yourself, or let AI suggest an arrangement. Each case study stays pinned to the version
          you added, so later edits never change an approved collection by surprise.
        </p>
      </header>
      <div className="mt-6">
        <ActionFeedback error={error} busy={busy} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-8">
          <section aria-labelledby="existing" className="space-y-2">
            <h2 id="existing" className="eyebrow">
              Your collections
            </h2>
            <ul className="divide-y border-y">
              {list.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={selected === item.id}
                    className="flex w-full items-center justify-between gap-2 px-2 py-3 text-left text-sm hover:bg-muted/50 aria-[current=true]:bg-muted"
                    onClick={() => void load(item.id, target)}
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                      {item.status === 'approved' ? 'Approved' : 'Draft'}
                    </Badge>
                  </button>
                </li>
              ))}
              {!list.length && (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  No collections yet
                </li>
              )}
            </ul>
          </section>

          <form
            aria-labelledby="new"
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void create()
            }}
          >
            <h2 id="new" className="eyebrow">
              New collection
            </h2>
            <div className="space-y-1">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collection-about">Company introduction (optional)</Label>
              <Textarea
                id="collection-about"
                value={about}
                maxLength={1200}
                onChange={(event) => setAbout(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collection-template">Template</Label>
              <select
                id="collection-template"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={preset}
                onChange={(event) => setPreset(event.target.value as PresetId)}
              >
                {PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {PRESETS.find((item) => item.id === preset)?.description} You can change it, or
                arrange every page yourself, after you create the collection.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Case studies</legend>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {documents.map((document) => (
                  <li key={document.id}>
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={chosen.includes(document.id)}
                        onChange={() => toggle(document.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 break-words">{document.title}</span>
                    </label>
                  </li>
                ))}
                {!documents.length && (
                  <li className="text-xs text-muted-foreground">
                    Save a case study version to add it here.
                  </li>
                )}
              </ul>
            </fieldset>
            <Button type="submit" size="sm" disabled={busy || !name.trim() || !chosen.length}>
              Create collection
            </Button>
          </form>
        </div>

        <section aria-live="polite" className="min-w-0">
          {!detail || !thumbs ? (
            <div className="py-20 text-center">
              <BookOpen aria-hidden="true" className="mx-auto mb-4 size-6 text-muted-foreground" />
              <p className="text-sm">Select or create a collection</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base font-semibold">{detail.name}</h2>
                {detail.state.approval === 'current' && (
                  <Badge>
                    <CheckCircle2 aria-hidden="true" /> Approved
                  </Badge>
                )}
                {detail.state.approval === 'stale' && (
                  <Badge variant="destructive">
                    <TriangleAlert aria-hidden="true" /> Needs re-approval
                  </Badge>
                )}
              </div>

              {detail.state.staleEntries.length > 0 && (
                <p role="alert" className="text-xs text-destructive">
                  {detail.state.staleEntries.length}{' '}
                  {detail.state.staleEntries.length === 1 ? 'case study has' : 'case studies have'}{' '}
                  changed since being added. Remove and add them again to pin the latest version.
                </p>
              )}

              <section aria-label="Pages" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold">
                    Pages{' '}
                    <span className="font-normal text-muted-foreground">
                      up to {detail.pagePlan.total} in the PDF
                    </span>
                  </h3>
                </div>
                <PageStrip
                  key={`${detail.id}-${detail.manifestHash}`}
                  label="Portfolio pages"
                  pages={detail.pagePlan.pages}
                  context={thumbs}
                />
                {detail.pagePlan.findings.length > 0 && (
                  <ul role="alert" className="space-y-1 text-xs text-destructive">
                    {detail.pagePlan.findings.map((finding) => (
                      <li key={finding.code + finding.message}>{finding.message}</li>
                    ))}
                  </ul>
                )}
              </section>

              <PortfolioBuilder
                name={detail.name}
                about={detail.manifest.wrapper.about}
                entries={detail.manifest.entries}
                design={detail.pagePlan.design}
                approved={detail.state.approval !== 'none'}
                busy={busy}
                error={null}
                onApply={(change) => update(change)}
                onArrange={arrange}
              />

              <section aria-label="Page budget" className="space-y-2 rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h3 className="text-xs font-semibold">Page budget</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="target" className="text-xs">
                      Target pages
                    </Label>
                    <Input
                      id="target"
                      type="number"
                      min={1}
                      max={500}
                      className="h-8 w-20"
                      value={target}
                      onChange={(event) => {
                        const next = Math.max(1, Number(event.target.value) || 1)
                        setTarget(next)
                        if (selected) void load(selected, next)
                      }}
                    />
                  </div>
                </div>
                <p>
                  Cover, introduction, contents and other portfolio pages{' '}
                  {detail.budget.wrapperPages} + case studies {detail.budget.entryPages} ={' '}
                  <strong>{detail.budget.total}</strong> of {target} pages
                </p>
                <p className="text-xs text-muted-foreground">
                  Entry pages are each layout&apos;s maximum until a rendered count is available.
                </p>
                {detail.budget.over && (
                  <div role="alert" className="space-y-1 text-xs text-destructive">
                    <p>This is {detail.budget.overBy} pages over the target. Options:</p>
                    <ul className="list-disc pl-5">
                      {detail.budget.suggestions.map((suggestion) => (
                        <li key={suggestion.kind}>
                          {suggestion.kind === 'use_concise'
                            ? `Use the concise layout for every entry (${suggestion.resultingTotal} pages).`
                            : `Remove ${suggestion.count} of the longest ${suggestion.count === 1 ? 'entry' : 'entries'} (${suggestion.resultingTotal} pages).`}
                        </li>
                      ))}
                      <li>Switch to the Compact template to drop the introduction and contents.</li>
                    </ul>
                  </div>
                )}
              </section>

              <section aria-label="Entries" className="space-y-2">
                <h3 className="text-xs font-semibold">Case studies and contents</h3>
                {orderedByDesign && (
                  <p className="text-xs text-muted-foreground">
                    This design keeps its own order. Reorder case studies under Build page by page.
                  </p>
                )}
                <ol className="divide-y border-y">
                  {detail.manifest.entries.map((entry, index) => {
                    const row = detail.contents.rows.find((item) => item.entryId === entry.entryId)
                    return (
                      <li key={entry.entryId} className="flex items-center gap-2 py-2 text-sm">
                        <span className="w-10 shrink-0 text-xs text-muted-foreground">
                          p. {row?.page ?? '–'}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {entry.category}
                        </span>
                        {!orderedByDesign && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Move ${entry.title} up`}
                              disabled={busy || index === 0}
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Move ${entry.title} down`}
                              disabled={busy || index === detail.manifest.entries.length - 1}
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${entry.title}`}
                          disabled={busy || detail.manifest.entries.length === 1}
                          onClick={() =>
                            void update({
                              entryIds: detail.manifest.entries
                                .filter((item) => item.entryId !== entry.entryId)
                                .map((item) => item.entryId),
                            })
                          }
                        >
                          <X />
                        </Button>
                      </li>
                    )
                  })}
                </ol>
                {!detail.contents.converged && (
                  <p role="alert" className="text-xs text-destructive">
                    Contents page numbers did not settle. Reduce the number of entries.
                  </p>
                )}
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    detail.state.approval === 'current' ||
                    detail.state.staleEntries.length > 0 ||
                    detail.pagePlan.findings.length > 0
                  }
                  onClick={() => void approve()}
                >
                  Approve this collection
                </Button>
                <p className="text-xs text-muted-foreground">
                  Approval covers the page design, order, introduction and pinned versions. Any
                  change withdraws it. Each case study keeps its own approval.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={urlFor('collections.preview', {
                      workspaceId,
                      collectionId: detail.id,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye /> Preview PDF
                  </a>
                </Button>
                {detail.state.approval === 'current' ? (
                  <Button size="sm" asChild>
                    <a
                      href={urlFor('collections.download', {
                        workspaceId,
                        collectionId: detail.id,
                      })}
                    >
                      <Download /> Download PDF
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The preview is watermarked. Approve the collection to download the final PDF.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
