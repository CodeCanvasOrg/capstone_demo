import type { InertiaProps } from '@/types'
import type { Data } from '@generated/data'

export default function Edit({ file }: InertiaProps<{ file: Data.File }>) {
  return <div>Hello {file.filename}</div>
}
