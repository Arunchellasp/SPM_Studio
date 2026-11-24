import { createContext, useContext } from 'react'
import type { FlowIssue } from './flow.rules'

/** problems per node id, from the canvas to its nodes (step 26) */
export const IssuesContext = createContext<Map<string, FlowIssue[]>>(new Map())

/**
 * The red badge on a node with problems (Software implementation › 4b.5: 'errors shown as red badges'):
 * the count on the node, every message in the tooltip and for screen readers. Nothing when the node is fine.
 */
export function IssueBadge({ node }: { node: string }): React.JSX.Element | null {
  const list = useContext(IssuesContext).get(node)
  if (!list?.length) return null
  const text = list.map((i) => i.message).join('\n')
  return (
    <span
      className="seq-badge"
      role="img"
      aria-label={`${list.length} ${list.length === 1 ? 'problem' : 'problems'}: ${list.map((i) => i.message).join('; ')}`}
      title={text}
    >
      {list.length}
    </span>
  )
}
