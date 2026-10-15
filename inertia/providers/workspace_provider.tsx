import { createContext, useContext, type PropsWithChildren } from 'react'
import { usePage } from '@inertiajs/react'
import type { Data } from '@generated/data'

type WorkspaceState = Pick<
  Data.SharedProps,
  'workspace' | 'workspaces' | 'membership' | 'workspaceCapabilities'
>
const WorkspaceContext = createContext<WorkspaceState | null>(null)
export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { workspace, workspaces, membership, workspaceCapabilities } =
    usePage<Data.SharedProps>().props
  return (
    <WorkspaceContext.Provider value={{ workspace, workspaces, membership, workspaceCapabilities }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('WorkspaceProvider is missing')
  return value
}
export function useWorkspaceId() {
  return usePage<Data.SharedProps>().props.workspace?.id ?? ''
}
