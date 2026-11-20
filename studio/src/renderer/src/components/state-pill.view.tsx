import type { MachineState } from '../stores/ui.store'
import './components.css'

/** PackML machine state as a coloured pill (N00 → "Machine state pill"). */
export function StatePill({ state }: { state: MachineState }): React.JSX.Element {
  return <span className={`state-pill st-${state.toLowerCase()}`}>{state}</span>
}
