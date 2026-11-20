import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../components/icon.view'
import { Segmented } from '../components/segmented.view'
import { StatePill } from '../components/state-pill.view'
import type { Mode } from '../model/machine'
import { useUi } from '../stores/ui.store'

const MODES: readonly Mode[] = ['Auto', 'Manual', 'Maintenance']
const COMMANDS: { id: IconName; label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'hold', label: 'Hold' },
  { id: 'stop', label: 'Stop' },
  { id: 'reset', label: 'Reset' }
]

/**
 * Header (56 px): product · cell · machine state · mode · commands · user and clock.
 * Same on every screen.
 */
export function Header(): React.JSX.Element {
  const cellName = useUi((s) => s.cellName)
  const userName = useUi((s) => s.userName)
  const machineState = useUi((s) => s.machineState)
  const mode = useUi((s) => s.mode)
  const setMode = useUi((s) => s.setMode)

  return (
    <header className="header">
      <div className="header-product">SPM Studio</div>
      <div className="header-cell">{cellName}</div>

      <StatePill state={machineState} />

      {/* since step 5 the shared Segmented component, dark tone */}
      <Segmented label="Machine mode" tone="dark" className="header-modes" options={MODES} value={mode} onChange={setMode} />

      <div className="header-commands">
        {COMMANDS.map((c) => (
          // Step 1: no runtime yet, so commands are shown but disabled
          <button key={c.id} disabled title="Connected to the runtime in a later step">
            <Icon name={c.id} /> {c.label}
          </button>
        ))}
      </div>

      <div className="header-user">
        {userName} · <Clock />
      </div>
    </header>
  )
}

/** Own component so only the clock re-renders every second, not the whole header. */
function Clock(): React.JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t) // stop the timer when the component goes away
  }, [])
  return <span className="mono">{now.toLocaleTimeString('en-GB')}</span>
}
