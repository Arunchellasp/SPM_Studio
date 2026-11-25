import { useEffect, useState } from 'react'
import { Icon } from '../components/icon.view'
import { Segmented } from '../components/segmented.view'
import { StatePill } from '../components/state-pill.view'
import { COMMANDS, MODES } from '@shared/packml'
import { useLive } from '../stores/live.store'
import { runtimeCommand } from '../stores/runtime-command'
import { useUi } from '../stores/ui.store'
import { commandView, modeView, type CommandContext } from './machine-commands'
import { RuntimeLink } from './runtime-link.view'

const LABEL = { start: 'Start', hold: 'Hold', stop: 'Stop', reset: 'Reset' } as const

/**
 * Header (56 px): product · cell · machine state · mode · commands · user and clock, runtime link under them (step 31).
 * Same on every screen. Step 32: state and mode come from the runtime; a button is on only when the runtime
 * is online, the user's role may do it and PackML allows it now — otherwise its tooltip says why.
 */
export function Header(): React.JSX.Element {
  const cellName = useUi((s) => s.cellName)
  const userName = useUi((s) => s.userName)
  const machineState = useUi((s) => s.machineState)
  const mode = useUi((s) => s.mode)
  const setMode = useUi((s) => s.setMode)
  const role = useUi((s) => s.userRole)
  const link = useLive((s) => s.status.link)
  const ctx: CommandContext = { link, state: machineState, mode, role }
  const online = link === 'online'

  return (
    <header className="header">
      <div className="header-product">SPM Studio</div>
      <div className="header-cell">{cellName}</div>

      <StatePill state={machineState} stale={!online} />

      {/* since step 5 the shared Segmented component, dark tone */}
      <Segmented
        label="Machine mode"
        tone="dark"
        className="header-modes"
        options={MODES.map((m) => {
          const v = modeView(m, ctx)
          return { value: m, disabled: !v.enabled, title: v.why }
        })}
        value={mode}
        onChange={(m) => m !== mode && setMode(m)}
      />

      <div className="header-commands">
        {COMMANDS.map((c) => {
          const v = commandView(c, ctx)
          return (
            <button key={c} disabled={!v.enabled} title={v.why} onClick={() => void runtimeCommand(c)}>
              <Icon name={c} /> {LABEL[c]}
            </button>
          )
        })}
      </div>

      <div className="header-side">
        <div className="header-user">
          {userName} · <Clock />
        </div>
        <RuntimeLink />
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
