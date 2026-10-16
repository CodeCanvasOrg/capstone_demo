import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
export const informationFields = [
  ['overview', 'Project overview'],
  ['problemStatement', 'Problem statement'],
  ['workCompleted', 'Work completed'],
  ['technicalApproach', 'Technical approach'],
  ['tools', 'Tools and technologies'],
  ['challenges', 'Challenges'],
  ['results', 'Results and impact'],
] as const
export type ProjectInformation = Partial<Record<(typeof informationFields)[number][0], string>>
export function ProjectFields({
  value,
  onChange,
}: {
  value: ProjectInformation
  onChange: (value: ProjectInformation) => void
}) {
  return (
    <div className="grid gap-5">
      {informationFields.map(([key, label]) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`info-${key}`}>{label}</Label>
          <Textarea
            id={`info-${key}`}
            rows={3}
            maxLength={20000}
            value={value[key] ?? ''}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          />
        </div>
      ))}
    </div>
  )
}
export function TitleField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="case-title">Case-study title</Label>
      <Input
        id="case-title"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        maxLength={255}
      />
    </div>
  )
}
