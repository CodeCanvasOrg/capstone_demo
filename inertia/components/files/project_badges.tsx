import { FolderOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/** Where a file lives: its linked projects, or nothing for a workspace file. */
export function ProjectBadges({ projects }: { projects?: { id: string; name: string }[] }) {
  if (!projects?.length) return null
  const shown = projects.slice(0, 2)
  return (
    <span className="hidden max-w-56 flex-wrap justify-end gap-1 sm:flex">
      {shown.map((project) => (
        <Badge key={project.id} variant="outline" className="max-w-40" title={project.name}>
          <FolderOpen aria-hidden="true" />
          <span className="truncate">{project.name}</span>
        </Badge>
      ))}
      {projects.length > shown.length && (
        <Badge variant="outline" title={projects.map((project) => project.name).join(', ')}>
          +{projects.length - shown.length}
        </Badge>
      )}
    </span>
  )
}
