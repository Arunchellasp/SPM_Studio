import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import { useLive } from '../stores/live'

export function StatusBar(): React.JSX.Element {
  const status = useLive((s) => s.status)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.spm?.appInfo().then(setInfo)
  }, [])

  return (
    <footer className="statusbar">
      <span className={`dot ${status.link}`} />
      <span>Runtime {status.link}</span>
      <span className="muted">{status.url}</span>
      {status.runtimeVersion && <span>v{status.runtimeVersion}</span>}
      {status.cycleUs !== undefined && (
        <span>
          cycle {status.cycleUs} µs · max {status.cycleMaxUs ?? '–'} µs
        </span>
      )}
      {status.lastError && status.link !== 'online' && <span className="warn">{status.lastError}</span>}
      <span className="spacer" />
      {info && (
        <span className="muted">
          Studio {info.version} · Electron {info.electron} · Chrome {info.chrome}
        </span>
      )}
    </footer>
  )
}
