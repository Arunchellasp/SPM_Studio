import { useState } from 'react'
import type { CommandResult } from '@shared/ipc'
import type { ScreenDef } from '../../app/screens'
import { useLive } from '../../stores/live'

/** N01 Overview — for now: proves the live link (state at 20 Hz, events, commands). */
export function Overview({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const link = useLive((s) => s.status.link)
  const state = useLive((s) => s.state)
  const events = useLive((s) => s.events)
  const [last, setLast] = useState<CommandResult | null>(null)

  const send = async (op: string, args?: Record<string, unknown>): Promise<void> => {
    setLast(await window.spm.runtime.command(op, args))
  }

  const entries = Object.entries(state.values)

  return (
    <section className="screen">
      <h1>
        {screen.code} {screen.title}
      </h1>

      <div className="cards">
        <div className="card">
          <div className="card-title">Runtime link</div>
          <div className={`big ${link}`}>{link.toUpperCase()}</div>
          <div className="muted">state frames received: {state.seq}</div>
        </div>

        <div className="card">
          <div className="card-title">Commands</div>
          <div className="row">
            <button disabled={link !== 'online'} onClick={() => send('start', { flow: 'S1_Main' })}>
              Start
            </button>
            <button disabled={link !== 'online'} onClick={() => send('stop')}>
              Stop
            </button>
            <button disabled={link !== 'online'} onClick={() => send('write', { tag: 'R_PartCount', value: 0 })}>
              Reset count
            </button>
          </div>
          <pre className="mono">{last ? JSON.stringify(last) : 'no command sent yet'}</pre>
        </div>

        <div className="card wide">
          <div className="card-title">Live values ({entries.length})</div>
          <table className="grid">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="mono">{typeof v === 'number' ? v.toFixed(2) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card wide">
          <div className="card-title">Events</div>
          <ul className="events">
            {events.slice(0, 12).map((e, i) => (
              <li key={`${e.ts}-${i}`}>
                <span className="mono">{new Date(e.ts).toLocaleTimeString()}</span> {e.ev}{' '}
                <span className="muted">{JSON.stringify({ ...e, ev: undefined, ts: undefined })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
