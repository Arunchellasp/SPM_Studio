import type { Priority } from '../model/machine'
import './components.css'

/**
 * Alarm priority: shape + colour + number (ISA-18.2 style), so it still reads
 * for colour-blind operators and on a bad screen.
 */
export function PriorityIcon({ p }: { p: Priority }): React.JSX.Element {
  return (
    <span className={`prio prio-${p}`} title={`Priority ${p}`}>
      <span>{p}</span>
    </span>
  )
}
