import type { MachineState } from '../stores/ui.store'
import './components.css'

/**
 * PackML machine state as a coloured pill (N00 → "Machine state pill").
 * md = header (150 × 32) · sm = inside cards, e.g. station cards on N01 (134 × 26, 12 px).
 */
export function StatePill({ state, size = 'md' }: { state: MachineState; size?: 'md' | 'sm' }): React.JSX.Element {
  return <span className={`state-pill state-pill-${size} st-${state.toLowerCase()}`}>{state}</span>
}
