import type { ScreenDef } from '../../app/screens'

export function Placeholder({ screen }: { screen: ScreenDef }): React.JSX.Element {
  return (
    <section className="screen">
      <h1>
        {screen.code} {screen.title}
      </h1>
      <div className="placeholder">
        Built in phase <b>{screen.phase}</b> of the build order (mind_map → Software implementation → section 9).
      </div>
    </section>
  )
}
