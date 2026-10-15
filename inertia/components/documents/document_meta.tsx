import { Form } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspaceId } from '@/providers/workspace_provider'
export function DocumentMeta({ document }: { document: Data.Document }) {
  const workspaceId = useWorkspaceId()
  return (
    <Form
      route="documents.update"
      routeParams={{ workspaceId, id: document.id }}
      className="flex flex-wrap items-end gap-3 p-4"
    >
      <input type="hidden" name="metadataRevision" value={document.metadataRevision} />
      <input type="hidden" name="description" value={document.description ?? ''} />
      <div className="min-w-0 flex-1">
        <Label htmlFor="document-title">Case study title</Label>
        <Input id="document-title" name="title" defaultValue={document.title ?? ''} required />
      </div>
      <Button type="submit" variant="outline">
        Save title
      </Button>
    </Form>
  )
}
