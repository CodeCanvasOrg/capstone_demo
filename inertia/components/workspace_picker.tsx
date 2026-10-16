import { useState } from 'react'
import { useRouter } from '@adonisjs/inertia/react'
import { ChevronsUpDown, Check, Plus } from 'lucide-react'
import { useWorkspace } from '@/providers/workspace_provider'
import { usePage } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
export function WorkspacePicker() {
  const { workspace, workspaces } = useWorkspace()
  const { user } = usePage().props
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Choose workspace"
          className="h-auto min-h-14 w-full justify-start gap-3 bg-transparent p-3 text-left"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
            {workspace?.name.slice(0, 2).toUpperCase() ?? 'WS'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">
              {workspace?.name ?? 'Choose workspace'}
            </span>
            <span className="mt-1 block text-[.625rem] text-muted-foreground">
              {workspace?.ownerUserId === user?.id ? 'Owner' : 'Team workspace'}
            </span>
          </span>
          <ChevronsUpDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Find a workspace…" />
          <CommandList>
            <CommandEmpty>No matching workspaces.</CommandEmpty>
            <CommandGroup heading="Your workspaces">
              {workspaces.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.id}`}
                  onSelect={() =>
                    router.post(
                      { route: 'workspaces.select', routeParams: { workspaceId: item.id } },
                      {},
                      { onSuccess: () => setOpen(false) }
                    )
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.name}</span>
                    <span className="text-[.625rem] text-muted-foreground">
                      {item.ownerUserId === user?.id ? 'Owner' : 'Member'}
                    </span>
                  </span>
                  {item.id === workspace?.id && <Check className="size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() =>
                  router.visit({ route: 'workspaces.index' }, { onSuccess: () => setOpen(false) })
                }
              >
                <Plus />
                Create or choose workspace
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
