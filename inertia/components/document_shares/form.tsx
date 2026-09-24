'use client'

import { type Data } from '@generated/data'
import { Form } from '@adonisjs/inertia/react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ShareRow } from './share_row'

type DocumentShareFormProps = {
  document: Data.Document
  shares: Data.DocumentShare[]
}

export default function DocumentShareForm({ document, shares }: DocumentShareFormProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite people by email. Separate multiple emails with commas.
          </DialogDescription>
        </DialogHeader>

        <Form route="shares.store" routeParams={{ documentId: document.id }}>
          {({ errors, processing }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="emails">Emails</Label>
              <Input
                id="emails"
                name="emails"
                type="text"
                placeholder="jane@example.com, john@example.com"
                aria-invalid={errors.emails ? 'true' : undefined}
              />
              <input type="hidden" name="role" value="edit" />
              {errors.emails && <p className="text-sm text-destructive">{errors.emails}</p>}
              <Button type="submit" className="mt-1 w-fit" disabled={processing}>
                <UserPlus />
                {processing ? 'Sharing…' : 'Share'}
              </Button>
            </div>
          )}
        </Form>

        <Separator />

        <div className="flex flex-col">
          <h3 className="text-sm font-medium">People with access</h3>
          {shares.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No one has access yet. Add an email above to share this document.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {shares.map((share) => (
                <ShareRow key={share.id} documentId={document.id} share={share} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
