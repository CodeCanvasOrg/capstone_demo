import { type ReactElement, useEffect, useRef } from 'react'
import { usePage, router } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { toast } from 'sonner'
import { safeMessage } from '@/lib/api'
import { Home, FolderOpen, Files, Users, Plus, LogOut, FileText, BookOpen } from 'lucide-react'
import type { Data } from '@generated/data'
import { WorkspacePicker } from '@/components/workspace_picker'
import { WorkspaceProvider, useWorkspace } from '@/providers/workspace_provider'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme_toggle'
import { BeeGuide, BeeTourButton } from '@/components/bee/bee_guide'
import { Button } from '@/components/ui/button'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

function NavigationCompletion() {
  const { setOpenMobile } = useSidebar()
  useEffect(
    () =>
      router.on('navigate', (event) => {
        const destination = new URL(event.detail.page.url, window.location.origin).pathname
        if (destination === lastPath.current) return
        lastPath.current = destination
        setOpenMobile(false)
        requestAnimationFrame(() => document.getElementById('main-content')?.focus())
      }),
    [setOpenMobile]
  )
  const lastPath = useRef(typeof window === 'undefined' ? '' : window.location.pathname)
  return null
}
function WorkspaceShell({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { workspace } = useWorkspace()
  const page = usePage<Data.SharedProps & { recentDocuments?: Data.RecentDocument[] }>()
  const user = page.props.user
  const base = workspace ? `/workspaces/${workspace.id}` : ''
  useEffect(() => {
    if (page.flash.error)
      toast.error(safeMessage(page.flash.error, 'This action could not finish. Try again.'), {
        duration: Infinity,
        closeButton: true,
      })
    if (page.flash.success) toast.success(page.flash.success)
  }, [page.flash])
  const items = workspace
    ? [
        {
          route: 'workspaces.show' as const,
          label: 'Home',
          icon: Home,
          active: page.url === base,
        },
        {
          route: 'documents.index' as const,
          label: 'Case studies',
          icon: FileText,
          active: page.url.startsWith(`${base}/documents`),
        },
        {
          route: 'projects.index' as const,
          label: 'Projects',
          icon: FolderOpen,
          active: page.url.startsWith(`${base}/projects`),
        },
        {
          route: 'collections.index' as const,
          label: 'Collections',
          icon: BookOpen,
          active: page.url.startsWith(`${base}/collections`),
        },
        {
          route: 'files.index' as const,
          label: 'Files',
          icon: Files,
          active: page.url.startsWith(`${base}/files`),
        },
        {
          route: 'workspace_members.index' as const,
          label: 'Members',
          icon: Users,
          active: page.url.startsWith(`${base}/members`),
        },
      ]
    : []
  return (
    <SidebarProvider style={{ '--sidebar-width': '16rem' } as React.CSSProperties}>
      <NavigationCompletion />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="gap-3 px-3 pt-3 pb-2 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              route="home"
              aria-label="CodeCanvas home"
              className="group-data-[collapsible=icon]:hidden"
            >
              <Brand />
            </Link>
            <SidebarTrigger aria-label="Toggle workspace navigation" className="shrink-0" />
          </div>
          <div data-tour="workspace">
            <WorkspacePicker />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup data-tour="nav">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.route}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.active}
                    className="h-8 text-xs font-medium"
                    tooltip={item.label}
                  >
                    <Link
                      route={item.route}
                      routeParams={{ workspaceId: workspace!.id }}
                      aria-current={item.active ? 'page' : undefined}
                      aria-label={item.label}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarSeparator />
          {workspace && (
            <SidebarGroup>
              <SidebarGroupLabel className="justify-between group-data-[collapsible=icon]:hidden">
                Recent
                <Button variant="ghost" size="icon-xs" asChild>
                  <Link
                    data-tour="new-small"
                    route="documents.create"
                    routeParams={{ workspaceId: workspace.id }}
                    aria-label="New case study"
                  >
                    <Plus />
                  </Link>
                </Button>
              </SidebarGroupLabel>
              <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="New case study">
                    <Link
                      route="documents.create"
                      routeParams={{ workspaceId: workspace.id }}
                      aria-label="New case study"
                    >
                      <Plus aria-hidden="true" />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarMenu className="group-data-[collapsible=icon]:hidden">
                {(page.props.recentDocuments ?? []).map((doc) => (
                  <SidebarMenuItem key={doc.id}>
                    <SidebarMenuButton asChild className="h-auto min-h-12 py-2">
                      <Link
                        route="documents.edit"
                        routeParams={{ workspaceId: workspace.id, id: doc.id }}
                        aria-label={doc.title}
                      >
                        <FileText className="size-4" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{doc.title}</span>
                          <span className="block text-[.625rem] text-muted-foreground">
                            {doc.status === 'approved' ? 'Approved' : 'In progress'}
                          </span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              {!page.props.recentDocuments?.length && (
                <p className="px-2 text-xs leading-5 text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No recent case studies.
                </p>
              )}
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
          <div data-tour="account" className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border text-xs">
              {user?.initials}
            </span>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-semibold">{user?.fullName || user?.email}</p>
              <p className="text-[.625rem] capitalize text-muted-foreground">
                {page.props.membership?.role ?? 'Account'}
              </p>
            </div>
            <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
              <BeeTourButton />
              <ThemeToggle />
              <Form route="session.destroy">
                <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out">
                  <LogOut className="size-4" />
                </Button>
              </Form>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-sidebar">
        <div className="flex h-11 items-center justify-between border-b bg-sidebar px-4 md:hidden">
          <SidebarTrigger aria-label="Open workspace navigation" />
          <span className="truncate text-xs font-semibold">{workspace?.name ?? 'CodeCanvas'}</span>
          <ThemeToggle />
        </div>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div key={workspace?.id ?? 'account'}>{children}</div>
        </main>
      </SidebarInset>
      <BeeGuide />
    </SidebarProvider>
  )
}
export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  )
}
