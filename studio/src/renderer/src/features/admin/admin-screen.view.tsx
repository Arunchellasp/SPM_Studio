import type { ScreenDef } from '../../app/screens'
import { Card } from '../../components/card.view'
import { Segmented } from '../../components/segmented.view'
import type { Theme } from '../../app/theme'
import { useUi } from '../../stores/ui.store'
import './admin-screen.css'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

/**
 * N10 Admin. Step 10 adds the first card, 'Display' (theme). Roles and audit follow in later steps.
 */
export function AdminScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const theme = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)

  return (
    <div className="adm">
      <div className="adm-head">
        <h1>
          <span className="adm-code">{screen.code}</span> {screen.title}
        </h1>
        <p className="adm-purpose">{screen.purpose}</p>
      </div>
      <div className="adm-grid">
        <Card title="Display">
          <div className="adm-row">
            <span className="adm-label" id="theme-label">
              Theme
            </span>
            <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
          </div>
          <p className="adm-note">
            Light is the standard (ISA-101 grey). Dark is for dark rooms and night shifts. Machine state and alarm colours are the same in
            both. The choice is kept on this PC after a restart.
          </p>
        </Card>
        <Card title="Roles and audit">
          <p className="adm-note">Permissions per action and the audit trail come in a later step.</p>
        </Card>
      </div>
    </div>
  )
}
