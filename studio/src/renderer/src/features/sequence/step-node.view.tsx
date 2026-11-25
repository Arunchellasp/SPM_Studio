import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Icon } from '../../components/icon.view'
import { stepDef, summary, type FlowNode, type StepKind } from './flow'
import { IssueBadge } from './issue-badge.view'
import { OnlineMark } from './online-mark.view'

/**
 * A step on the canvas (step 24): icon + title, and a one-line summary of its parameters.
 * Shape by meaning (ISO 5807 + Improved design › N02): an action is a rectangle (Move, Set output),
 * waiting for a condition a hexagon (like the transitions of the design), Delay the D-shaped 'delay' symbol.
 * One way in (top), one way out (bottom).
 */
export function StepNode({ id, type, data, selected }: NodeProps<FlowNode>): React.JSX.Element {
  const def = stepDef(type as StepKind)
  const text = summary(type, data.p)
  return (
    <div
      className={['seq-step', `seq-shape-${def.shape}`, text.includes('?') ? 'seq-open' : '', selected ? 'seq-selected' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${data.name || def.title}: ${text}`}
      data-kind={def.title}
    >
      {def.shape !== 'process' && (
        <svg className="seq-outline" viewBox="0 0 260 54" preserveAspectRatio="none" aria-hidden="true">
          {def.shape === 'condition' ? (
            <polygon points="18,1 242,1 259,27 242,53 18,53 1,27" />
          ) : (
            <path d="M1,1 H226 A26,26 0 0 1 226,53 H1 Z" />
          )}
        </svg>
      )}
      <Handle type="target" position={Position.Top} aria-label="link in" />
      <div className="seq-step-title">
        <Icon name={def.icon} />
        <span>{data.name || def.title}</span>
      </div>
      <div className="seq-step-sum" title={text}>
        {text}
      </div>
      <Handle type="source" position={Position.Bottom} aria-label="link out" />
      <IssueBadge node={id} />
      <OnlineMark node={id} />
    </div>
  )
}
