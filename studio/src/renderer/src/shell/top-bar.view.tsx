import { useEffect, useState } from 'react'
import type { ScreenDef } from '../app/screens'
import { useLive } from '../stores/live'

export function TopBar({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const link = useLive((s) => s.status.link)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="topbar">
      <div className="brand">
        SPM <span>Studio</span>
      </div>
      <div className="crumb">
        <span className="code">{screen.code}</span> {screen.title}
      </div>
      <div className="spacer" />
      <div className={`state-pill ${link}`}>
        Machine: {link === 'online' ? 'CONNECTED' : link === 'connecting' ? 'CONNECTING' : 'RUNTIME OFFLINE'}
      </div>
      <div className="mode">Mode: —</div>
      <div className="user">User: engineer</div>
      <div className="clock">{clock.toLocaleTimeString()}</div>
    </header>
  )
}
