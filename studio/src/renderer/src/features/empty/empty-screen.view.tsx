import type { ScreenDef } from '../../app/screens'
import './empty-screen.css'

/** Placeholder used by every screen in step 1. Each screen gets its own folder when we build it. */
export function EmptyScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  return (
    <section className="empty">
      <h1>
        <span className="empty-code">{screen.code}</span> {screen.title}
      </h1>
      <p className="empty-purpose">{screen.purpose}</p>
      <div className="empty-box">Screen content comes in a later step.</div>
    </section>
  )
}
