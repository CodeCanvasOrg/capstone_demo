import { Node, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

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
export const informationSectionName = (key: string) => `information_${key}`

/** Each heading belongs to the schema, leaving all body blocks freely editable. */
export const projectInformationExtensions = () => [
  StarterKit.configure({
    document: false,
    trailingNode: false,
    heading: { levels: [3, 4] },
    link: { openOnClick: false },
  }),
  Node.create({
    name: 'doc',
    topNode: true,
    content: informationFields.map(([key]) => informationSectionName(key)).join(' '),
  }),
  ...informationFields.map(([key, label]) =>
    Node.create({
      name: informationSectionName(key),
      content: 'block+',
      defining: true,
      isolating: true,
      selectable: false,
      parseHTML: () => [
        { tag: `section[data-information="${key}"]`, contentElement: '.information-body' },
      ],
      renderHTML: () => [
        'section',
        { 'data-information': key, 'aria-label': label },
        ['h2', { contenteditable: 'false' }, label],
        ['div', { class: 'information-body' }, 0],
      ],
    })
  ),
]

/** Render legacy strings without interpreting user text as HTML or Markdown. */
export function informationToContent(value: ProjectInformation): JSONContent {
  return {
    type: 'doc',
    content: informationFields.map(([key]) => ({
      type: informationSectionName(key),
      content: (value[key] ?? '').split('\n').map((line) => ({
        type: 'paragraph',
        ...(line ? { content: [{ type: 'text', text: line }] } : {}),
      })),
    })),
  }
}
