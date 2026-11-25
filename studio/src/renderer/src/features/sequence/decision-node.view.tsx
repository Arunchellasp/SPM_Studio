import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Icon } from '../../components/icon.view'
import { useSequence } from '../../stores/sequence.store'
import { summary, type FlowNode } from './flow'
import { IssueBadge } from './issue-badge.view'
import { OnlineMark } from './online-mark.view'

/**
 * Decision (step 26): the diamond of flowcharts (ISO 5807). One way in (top); two ways out, each labelled —
 * 'yes' straight on (bottom), 'no' to the side (right), the usual flowchart layout.
 * Software implementation › 4b.2: 'Decision has yes / no handles'.
 */
export function DecisionNode({ id, data, selected }: NodeProps<FlowNode>): React.JSX.Element {
  const text = summary('if', data.p)
  // the label next to a dot only while that way is open — once linked, the link itself says yes / no
  const linked = useSequence((s) =>
    s.edges
      .filter((e) => e.source === id)
      .map((e) => e.sourceHandle ?? '')
      .join(' ')
  )
  return (
    <div
      className={['seq-step', 'seq-decision', text.includes('?') ? 'seq-open' : '', selected ? 'seq-selected' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${data.name || 'Decision'}: ${text}`}
      data-kind="Decision"
    >
      <svg className="seq-outline" viewBox="0 0 260 80" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="130,1 259,40 130,79 1,40" />
      </svg>
      <Handle type="target" position={Position.Top} aria-label="link in" />
      <div className="seq-step-title">
        <Icon name="decision" />
        <span>{data.name || 'Decision'}</span>
      </div>
      <div className="seq-step-sum" title={text}>
        {text}
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" aria-label="yes way out" />
      {!linked.includes('yes') && (
        <span className="seq-way seq-way-yes" aria-hidden="true">
          yes
        </span>
      )}
      <Handle type="source" position={Position.Right} id="no" aria-label="no way out" />
      {!linked.includes('no') && (
        <span className="seq-way seq-way-no" aria-hidden="true">
          no
        </span>
      )}
      <IssueBadge node={id} />
      <OnlineMark node={id} />
    </div>
  )
}
