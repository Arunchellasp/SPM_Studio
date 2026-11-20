import { useId, useRef, useState, type ReactNode } from 'react'
import { nextIndex } from './roving'
import './tabs.css'

export interface TabItem {
  id: string
  label: ReactNode
  /** what the panel shows while this tab is selected */
  content: ReactNode
  disabled?: boolean
}

/**
 * Tabs (N00): a tab bar and the panel of the selected tab.
 * One Tab stop on the bar; ← → Home End move between tabs and show their panel.
 * Uncontrolled (defaultValue) or controlled (value + onChange), like an <input>.
 */
export interface TabsProps {
  label: string
  tabs: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  className?: string
}

export function Tabs({ label, tabs, value, defaultValue, onChange, className = '' }: TabsProps): React.JSX.Element {
  const [own, setOwn] = useState(defaultValue ?? tabs[0]?.id)
  const selected = value ?? own // controlled if value is given
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(
    0,
    tabs.findIndex((t) => t.id === selected)
  )

  function select(id: string): void {
    if (value === undefined) setOwn(id)
    onChange?.(id)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    const to = nextIndex(
      e.key,
      current,
      tabs.map((t) => !!t.disabled)
    )
    if (to === null || e.key === 'ArrowUp' || e.key === 'ArrowDown') return // tabs run left → right only
    e.preventDefault()
    select(tabs[to].id)
    refs.current[to]?.focus()
  }

  const active = tabs[current]
  return (
    <div className={['tabs', className].filter(Boolean).join(' ')}>
      <div className="tabs-list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t, i) => {
          const on = i === current
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              disabled={t.disabled}
              className="tab"
              onClick={() => select(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {active && (
        <div id={`${base}-panel`} className="tabs-panel" role="tabpanel" aria-labelledby={`${base}-tab-${active.id}`} tabIndex={0}>
          {active.content}
        </div>
      )}
    </div>
  )
}
