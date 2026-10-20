import { Fragment, type Node } from '@tiptap/pm/model'

function fillOpenBlocks(node: Node): Node {
  if (node.isLeaf) return node
  const children: Node[] = []
  node.forEach((child) => children.push(fillOpenBlocks(child)))
  // A cut may land inside a list before its first required paragraph exists.
  return node.type.createAndFill(node.attrs, Fragment.fromArray(children), node.marks)!
}

/** A document prefix with intact block structure, marks and atomic evidence nodes. */
export function writingReveal(document: Node, progress: number) {
  if (progress >= 1) return document.toJSON()
  let position = Math.max(0, Math.floor(document.content.size * Math.max(0, progress)))
  const resolved = document.resolve(position)
  if (resolved.nodeBefore?.isText && /[\uD800-\uDBFF]$/.test(resolved.nodeBefore.text ?? ''))
    position--
  return fillOpenBlocks(document.cut(0, position)).toJSON()
}
