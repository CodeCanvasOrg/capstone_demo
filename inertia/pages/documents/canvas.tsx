import { Head } from '@inertiajs/react'

type Props = {
  document: { id: string; title: string }
  workspaceId: string
}

/** Canvas editor page. The editor itself is mounted in phase 4. */
export default function CanvasPage({ document }: Props) {
  return (
    <>
      <Head title={`${document.title} · Canvas`} />
      <main className="p-6">Canvas editor</main>
    </>
  )
}
