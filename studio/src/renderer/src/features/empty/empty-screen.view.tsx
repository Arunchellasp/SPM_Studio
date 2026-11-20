import type { ScreenDef } from '../../app/screens'
import { Card } from '../../components/card.view'
import './empty-screen.css'

/** Placeholder used by every screen that has no view yet. Each screen gets its own folder when we build it. */
export function EmptyScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  return (
    <Card fill className="empty">
      <h1>
        <span className="empty-code">{screen.code}</span> {screen.title}
      </h1>
      <p className="empty-purpose">{screen.purpose}</p>
      <div className="empty-box">Screen content comes in a later step.</div>
    </Card>
  )
}
