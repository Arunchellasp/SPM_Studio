import { useState } from 'react'
import { SCREENS } from './screens'
import { TopBar } from '../shell/top-bar.view'
import { NavRail } from '../shell/nav-rail.view'
import { StatusBar } from '../shell/status-bar.view'

export function App(): React.JSX.Element {
  const [active, setActive] = useState(SCREENS[0].id)
  const screen = SCREENS.find((s) => s.id === active) ?? SCREENS[0]
  const Screen = screen.component

  return (
    <div className="app">
      <TopBar screen={screen} />
      <NavRail screens={SCREENS} active={active} onSelect={setActive} />
      <main className="content">
        <Screen screen={screen} />
      </main>
      <StatusBar />
    </div>
  )
}
