import { Head, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  FileText,
  Image,
  Layers,
  ScanText,
  Sparkles,
} from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const steps = [
  {
    number: '01',
    icon: Layers,
    title: 'Bring the pieces together.',
    description:
      'Upload documents, notes, and images. Keep your source material in one library, ready for the next story.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Find the story in your work.',
    description:
      'Give your document a direction. AI prepares a draft using your files, with source citations to help you review it.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Make it unmistakably yours.',
    description:
      'Refine the narrative in the editor, add the finishing touches, and share or export your document.',
  },
]

function DocumentPreview() {
  return (
    <div
      className="relative isolate px-3 pb-8 pt-4 sm:px-6"
      role="img"
      aria-label="Illustrative preview: source files become an editable case study with citations"
    >
      <div className="absolute inset-x-0 bottom-0 top-10 -z-10 border border-border bg-secondary" />
      <div className="mb-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-2 bg-primary" />
          SOURCE → STORY
        </span>
        <span>EXAMPLE WORKSPACE</span>
      </div>
      <Card className="gap-0 border border-border py-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <span className="flex items-center gap-2 text-xs">
            <FileText className="size-3.5" />
            Project story
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3" />
            Draft
          </span>
        </div>
        <CardContent className="space-y-5 p-5 sm:p-7">
          <Badge variant="secondary" className="text-xs">
            CASE STUDY / 001
          </Badge>
          <p className="font-heading text-3xl leading-tight sm:text-4xl">
            Small beginnings.
            <br />
            Meaningful impact.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A clearer picture of the challenge, the decisions, and the work that made a difference.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-semibold">The challenge</p>
              <div className="h-1.5 w-full bg-muted" />
              <div className="h-1.5 w-4/5 bg-muted" />
              <div className="h-1.5 w-3/5 bg-muted" />
            </div>
            <div className="relative flex min-h-24 items-center justify-center border border-border bg-secondary">
              <svg viewBox="0 0 160 90" className="h-24 w-full" aria-hidden="true">
                <path d="M20 70H140M20 20V70" fill="none" className="stroke-border" />
                <path d="M30 60L55 48L80 51L105 30L130 20V70H30Z" className="fill-primary/20" />
                <path
                  d="M30 60L55 48L80 51L105 30L130 20"
                  fill="none"
                  strokeWidth="3"
                  className="stroke-foreground"
                />
                <rect x="126" y="16" width="8" height="8" className="fill-primary" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <ScanText className="size-4" />
            <span>Connected to your source material</span>
            <span className="ml-auto bg-primary px-1.5 py-0.5 font-medium text-primary-foreground">
              [1]
            </span>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-3">
          <FileText className="size-4 shrink-0" />
          <span className="truncate">Project notes.pdf</span>
        </div>
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-3">
          <Image className="size-4 shrink-0" />
          <span className="truncate">Research image.jpg</span>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { props } = usePage()
  const startRoute = props.user ? 'documents.create' : 'new_account.create'

  return (
    <>
      <Head title="Source to story" />
      <div className="mx-auto max-w-5xl px-4">
        <section className="grid items-center gap-12 pb-14 pt-14 md:grid-cols-2 md:gap-10 md:pb-20 md:pt-20">
          <Reveal className="space-y-7">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="size-2 bg-primary" aria-hidden="true" />
              Built from your work
            </p>
            <h1 className="font-heading text-5xl leading-none tracking-tight sm:text-6xl lg:text-7xl">
              Good work deserves
              <br />
              <span className="relative inline-block">
                <span
                  className="absolute inset-x-0 bottom-1 -z-10 h-4 bg-primary sm:h-5"
                  aria-hidden="true"
                />
                a great story.
              </span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Turn your documents, notes, and images into a case study worth sharing. From the first
              draft to the final detail, keep your sources close and your voice in the story.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link route={startRoute}>
                  {props.user ? 'Create a document' : 'Start your story'}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">
                  See how it works
                  <ArrowDown aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ScanText aria-hidden="true" className="size-4" />
              Your source material. Your perspective.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <DocumentPreview />
          </Reveal>
        </section>
        <div className="grid grid-cols-1 divide-y divide-border border-y border-border text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { icon: Layers, label: 'One source library' },
            { icon: ScanText, label: 'Drafts with citations' },
            { icon: FileText, label: 'An editor that stays yours' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-5">
              <Icon aria-hidden="true" className="size-4" />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <section id="how-it-works" className="scroll-mt-8 py-16 md:py-24">
          <Reveal className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                From scattered files to a clear narrative
              </p>
              <h2 className="font-heading text-4xl tracking-tight sm:text-5xl">
                Less blank page.
                <br />
                More possibility.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A simple workflow that gives your ideas room to take shape.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map(({ number, icon: Icon, title, description }, index) => (
              <Reveal key={number} delay={index * 0.08}>
                <Card className="h-full gap-0 border-t-2 border-t-primary py-0">
                  <CardContent className="space-y-7 p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-3xl text-muted-foreground">{number}</span>
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-heading text-2xl leading-tight">{title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
        <Reveal>
          <section className="grid gap-8 border border-border bg-secondary p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Make something worth sharing
              </p>
              <h2 className="font-heading text-4xl tracking-tight sm:text-5xl">
                The next story is yours.
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Start with the work you already have. Bring it together in a document you can edit,
                refine, and share.
              </p>
            </div>
            <Button asChild size="lg" className="justify-self-start">
              <Link route={startRoute}>
                Let’s get started
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </section>
        </Reveal>
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border py-7 text-xs text-muted-foreground">
          <span>REACT / Source to story.</span>
          <span>© {new Date().getFullYear()} REACT</span>
        </footer>
      </div>
    </>
  )
}
