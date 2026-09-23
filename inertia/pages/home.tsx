import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-14">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl leading-tight">
          It works — welcome to the power of a full-stack React app
        </h1>
        <p className="mt-3 text-muted-foreground">
          Powered by Inertia and React, this setup blends server-driven routing with rich
          client-side interactivity — seamless, fast, and cohesive.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <a
          href="https://docs.adonisjs.com/introduction"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col gap-2 border border-border p-5 transition-colors hover:border-border-strong"
        >
          <h3 className="font-medium group-hover:underline">Official Docs &nbsp;›</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive reference for building with AdonisJS
          </p>
        </a>

        <a
          href="https://adocasts.com/"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col gap-2 border border-border p-5 transition-colors hover:border-border-strong"
        >
          <h3 className="font-medium group-hover:underline">Adocasts &nbsp;›</h3>
          <p className="text-sm text-muted-foreground">
            Guided video tutorials for everyday development
          </p>
        </a>

        <a
          href="https://discord.gg/vDcEjq6"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col gap-2 border border-border p-5 transition-colors hover:border-border-strong"
        >
          <h3 className="font-medium group-hover:underline">Discord &nbsp;›</h3>
          <p className="text-sm text-muted-foreground">
            Connect with developers building with AdonisJS every day
          </p>
        </a>
      </div>

      <div className="flex gap-4">
        <Button size="lg">Ready to Build</Button>
        <Button size="lg" variant="outline">
          Learn more
        </Button>
      </div>
    </div>
  )
}
