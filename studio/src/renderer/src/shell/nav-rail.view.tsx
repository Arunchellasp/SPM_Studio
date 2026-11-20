import { SCREENS } from '../app/screens'
import { Icon } from '../components/icon.view'
import { useUi } from '../stores/ui.store'

/** Navigation rail (88 px): one button per task area, icon + label. */
export function NavRail(): React.JSX.Element {
  const active = useUi((s) => s.activeScreen)
  const openScreen = useUi((s) => s.openScreen)

  return (
    <nav className="rail" aria-label="Task areas">
      {SCREENS.map((s) => (
        <button
          key={s.id}
          className={`rail-item ${s.id === active ? 'active' : ''} ${s.devOnly ? 'rail-dev' : ''}`}
          aria-current={s.id === active ? 'page' : undefined}
          title={`${s.code} ${s.title}`}
          onClick={() => openScreen(s.id)}
        >
          <Icon name={s.icon} className="rail-icon" />
          <span className="rail-label">{s.label}</span>
        </button>
      ))}
    </nav>
  )
}
