import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePage, router } from '@inertiajs/react'
import type { Data } from '@generated/data'
type WorkspaceContextValue = Pick<
  Data.SharedProps,
  'workspace' | 'workspaces' | 'membership' | 'workspaceCapabilities'
> & {
  dirty: boolean
  dirtyKeys: string[]
  setDirty: (key: string, dirty: boolean) => void
  confirmNavigation: () => boolean
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const props = usePage<Data.SharedProps>().props
  const [unsaved, setUnsaved] = useState<Record<string, boolean>>({})
  const dirty = Object.values(unsaved).some(Boolean)
  const setDirty = useCallback(
    (key: string, value: boolean) =>
      setUnsaved((previous) =>
        previous[key] === value ? previous : { ...previous, [key]: value }
      ),
    []
  )
  const confirmNavigation = useCallback(
    () => !dirty || window.confirm('You have unsaved changes. Leave this page and discard them?'),
    [dirty]
  )
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', leave)
    const off = router.on('before', (event) => {
      const visit = event.detail.visit
      if (
        (visit.method === 'get' && visit.url.pathname !== window.location.pathname) ||
        visit.url.pathname.endsWith('/selection') ||
        visit.url.pathname.endsWith('/logout')
      )
        return confirmNavigation()
    })
    return () => {
      off()
      window.removeEventListener('beforeunload', leave)
    }
  }, [dirty, confirmNavigation])
  const value = useMemo(
    () => ({
      workspace: props.workspace,
      workspaces: props.workspaces,
      membership: props.membership,
      workspaceCapabilities: props.workspaceCapabilities,
      dirty,
      dirtyKeys: Object.keys(unsaved).filter((key) => unsaved[key]),
      setDirty,
      confirmNavigation,
    }),
    [
      props.workspace,
      props.workspaces,
      props.membership,
      props.workspaceCapabilities,
      dirty,
      unsaved,
      setDirty,
      confirmNavigation,
    ]
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('WorkspaceProvider is missing')
  return context
}
export function useWorkspaceId() {
  return usePage<Data.SharedProps>().props.workspace?.id ?? ''
}
export function useUnsavedChanges(key: string, dirty: boolean) {
  const { setDirty } = useWorkspace()
  useEffect(() => {
    setDirty(key, dirty)
    return () => setDirty(key, false)
  }, [key, dirty, setDirty])
}
