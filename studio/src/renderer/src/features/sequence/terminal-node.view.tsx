import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNode } from './flow'
import { IssueBadge } from './issue-badge.view'

/**
 * Start and End: the rounded 'terminal' shape of flowcharts (ISO 5807), so they are told apart from steps
 * (rectangles) and conditions (hexagons, Improved design › N02) at a glance. Start has one way out (bottom),
 * End one way in (top).
 */
export function TerminalNode({ id, data, type, selected }: NodeProps<FlowNode>): React.JSX.Element {
  const start = type === 'start'
  return (
    <div
      className={['seq-terminal', start ? 'seq-start' : 'seq-end', selected ? 'seq-selected' : ''].filter(Boolean).join(' ')}
      aria-label={`${data.label} node`}
    >
      {!start && <Handle type="target" position={Position.Top} aria-label="link in" />}
      <span>{data.label}</span>
      {start && <Handle type="source" position={Position.Bottom} aria-label="link out" />}
      <IssueBadge node={id} />
    </div>
  )
}
