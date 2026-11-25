import type { MachineState } from '../model/machine'
import './components.css'

/**
 * PackML machine state as a coloured pill (N00 → "Machine state pill").
 * md = header (150 × 32) · sm = inside cards, e.g. station cards on N01 (134 × 26, 12 px).
 * Step 32: acting states (STARTING, STOPPING …) share the blue 'acting' colour; stale = runtime offline (faded).
 */
export function StatePill({
  state,
  size = 'md',
  stale = false
}: {
  state: MachineState
  size?: 'md' | 'sm'
  stale?: boolean
}): React.JSX.Element {
  return (
    <span
      className={`state-pill state-pill-${size} st-${state.toLowerCase()}${stale ? ' state-pill-stale' : ''}`}
      title={stale ? `${state} — last known state, the runtime is not connected` : undefined}
    >
      {state}
    </span>
  )
}
