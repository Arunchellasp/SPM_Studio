import { SCREENS } from '../app/screens'
import { EmptyScreen } from '../features/empty/empty-screen.view'
import { useUi } from '../stores/ui.store'
import { AlarmBanner } from './alarm-banner.view'
import { Header } from './header.view'
import { NavRail } from './nav-rail.view'
import './shell.css'

/**
 * The frame shared by every window (N00 "Shell 1920 × 1080"):
 *
 *   ┌──────────────── header 56 ────────────────┐
 *   │ rail 88 │          content               │
 *   ├──────────────── banner 36 ────────────────┤
 */
export function AppShell(): React.JSX.Element {
  const activeId = useUi((s) => s.activeScreen)
  const screen = SCREENS.find((s) => s.id === activeId) ?? SCREENS[0]

  return (
    <div className="shell">
      <Header />
      <NavRail />
      <main className="content">
        {/* Step 1: every screen is the same empty placeholder */}
        <EmptyScreen screen={screen} />
      </main>
      <AlarmBanner />
    </div>
  )
}
