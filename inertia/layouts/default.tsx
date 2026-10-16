import { type ReactElement, useEffect, useRef } from 'react'
import { usePage, router } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { toast } from 'sonner'
import { Home, FolderOpen, Files, Users, Plus, LogOut, FileText, ArrowUpRight } from 'lucide-react'
import type { Data } from '@generated/data'
import { WorkspacePicker } from '@/components/workspace_picker'
import { WorkspaceProvider, useWorkspace } from '@/providers/workspace_provider'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme_toggle'
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
    if (page.flash.error) toast.error(page.flash.error)
    if (page.flash.success) toast.success(page.flash.success)
  }, [page.flash])
  const items = workspace
    ? [
        {
          route: 'workspaces.show' as const,
          label: 'Workspace home',
          icon: Home,
          active: page.url === base,
        },
        {
          route: 'documents.index' as const,
          label: 'All case studies',
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
          route: 'files.index' as const,
          label: 'Files library',
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
      <Sidebar collapsible="offcanvas" className="border-r">
        <SidebarHeader className="gap-5 px-4 pt-6 pb-3">
          <Link route="home" aria-label="CodeCanvas home">
            <Brand />
          </Link>
          <WorkspacePicker />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.route}>
                  <SidebarMenuButton asChild isActive={item.active} className="h-9 font-medium">
                    <Link
                      route={item.route}
                      routeParams={{ workspaceId: workspace!.id }}
                      aria-current={item.active ? 'page' : undefined}
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
              <SidebarGroupLabel className="justify-between">
                Recent documents
                <Button variant="ghost" size="icon-xs" asChild>
                  <Link
                    route="documents.create"
                    routeParams={{ workspaceId: workspace.id }}
                    aria-label="New case study"
                  >
                    <Plus />
                  </Link>
                </Button>
              </SidebarGroupLabel>
              <SidebarMenu>
                {(page.props.recentDocuments ?? []).map((doc) => (
                  <SidebarMenuItem key={doc.id}>
                    <SidebarMenuButton asChild className="h-auto min-h-12 py-2">
                      <Link
                        route="documents.edit"
                        routeParams={{ workspaceId: workspace.id, id: doc.id }}
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
                <p className="px-2 text-xs leading-5 text-muted-foreground">
                  Your recent case studies will appear here.
                </p>
              )}
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border text-xs">
              {user?.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.fullName || user?.email}</p>
              <p className="text-[.625rem] capitalize text-muted-foreground">
                {page.props.membership?.role ?? 'Account'}
              </p>
            </div>
            <ThemeToggle />
            <Form route="session.destroy">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </Form>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <div className="flex h-12 items-center justify-between border-b bg-sidebar px-4 md:hidden">
          <SidebarTrigger aria-label="Open workspace navigation" />
          <span className="truncate text-xs font-semibold">{workspace?.name ?? 'CodeCanvas'}</span>
          <ThemeToggle />
        </div>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div key={workspace?.id ?? 'account'}>{children}</div>
        </main>
        <footer className="flex items-center justify-between gap-3 border-t px-6 py-4 text-[.625rem] text-muted-foreground">
          <span>HumbleBeeAI · Human direction. Intelligent systems.</span>
          <Link
            route="workspaces.index"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Your workspaces
            <ArrowUpRight className="size-3" />
          </Link>
        </footer>
      </SidebarInset>
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
