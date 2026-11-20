import type { ScreenDef } from '../app/screens'

interface Props {
  screens: ScreenDef[]
  active: string
  onSelect: (id: string) => void
}

export function NavRail({ screens, active, onSelect }: Props): React.JSX.Element {
  const groups = [...new Set(screens.map((s) => s.group))]
  return (
    <nav className="navrail">
      {groups.map((g) => (
        <div key={g} className="nav-group">
          <div className="nav-group-title">{g}</div>
          {screens
            .filter((s) => s.group === g)
            .map((s) => (
              <button key={s.id} className={`nav-item ${s.id === active ? 'active' : ''}`} onClick={() => onSelect(s.id)}>
                <span className="code">{s.code}</span>
                {s.title}
              </button>
            ))}
        </div>
      ))}
    </nav>
  )
}
