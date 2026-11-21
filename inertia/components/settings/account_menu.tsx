import { usePage } from '@inertiajs/react'
import { useRouter } from '@adonisjs/inertia/react'
import {
  Bell,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plug,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react'
import type { Data } from '@generated/data'
import { useTheme, type ThemePreference } from '@/components/theme_provider'
import { startBeeTour } from '@/components/bee/bee_guide'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useSettings } from './settings_dialog'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function AccountMenu() {
  const { user, membership, preferences } = usePage<Data.SharedProps>().props
  const { openSettings } = useSettings()
  const { preference, setTheme } = useTheme()
  const { isMobile, state } = useSidebar()
  const router = useRouter()
  const showGuide = preferences?.interface.showGuide ?? true

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-tour="account"
              tooltip="Account & settings"
              aria-label="Account and settings"
              className="h-12 data-[state=open]:bg-sidebar-accent"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium">
                {user?.initials}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs font-semibold">
                  {user?.fullName || user?.email}
                </span>
                <span className="block truncate text-[.625rem] capitalize text-muted-foreground">
                  {membership?.role ?? 'Account'}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'top' : state === 'collapsed' ? 'right' : 'top'}
            align={state === 'collapsed' && !isMobile ? 'end' : 'start'}
            sideOffset={8}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
                {user?.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {user?.fullName || 'Your account'}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openSettings('profile')}>
                <User /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings('preferences')}>
                <Settings /> Settings
                <DropdownMenuShortcut>{isMac ? '⌘,' : 'Ctrl+,'}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings('notifications')}>
                <Bell /> Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openSettings('api-keys')}>
                <KeyRound /> API keys
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings('connectors')}>
                <Plug /> Connectors
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette /> Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={preference}
                  onValueChange={(value) => setTheme(value as ThemePreference)}
                >
                  <DropdownMenuRadioItem value="light">
                    <Sun /> Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon /> Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor /> System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {showGuide && (
              <DropdownMenuItem onSelect={startBeeTour}>
                <Sparkles /> Replay welcome tour
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => router.post({ route: 'session.destroy' }, {})}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
