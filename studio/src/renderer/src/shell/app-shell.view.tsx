import { SCREENS } from '../app/screens'
import { useScreenScale } from '../app/screen-scale'
import { ConfirmDialogHost } from '../components/dialog.view'
import { ToastHost } from '../components/toast.view'
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
 *
 * Since step 9 the shell is drawn at design size and zoomed to the window (app/screen-scale.ts).
 */
export function AppShell(): React.JSX.Element {
  const activeId = useUi((s) => s.activeScreen)
  const screen = SCREENS.find((s) => s.id === activeId) ?? SCREENS[0]
  const View = screen.view ?? EmptyScreen // screens without their own view use the placeholder
  const { zoom, width, height } = useScreenScale() // step 9: fit 1366 × 768, 1280 × 1024, Windows 125 / 150 %

  return (
    <div className="shell" style={{ zoom, width, height }} data-zoom={zoom}>
      <Header />
      <NavRail />
      <main className="content">
        <View screen={screen} />
      </main>
      <AlarmBanner />
      {/* step 8: floating layers, drawn above everything else */}
      <ToastHost />
      <ConfirmDialogHost />
    </div>
  )
}
