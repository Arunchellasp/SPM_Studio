import { useRef, type ReactNode } from 'react'
import { nextIndex } from './roving'
import './segmented.css'

export interface SegmentOption<T extends string> {
  value: T
  label?: ReactNode // defaults to the value
  disabled?: boolean
}

/**
 * Segmented switch (N00): choose exactly one of a few options (Auto / Manual / Maint.).
 * Behaves like a radio group: one Tab stop, arrow keys move AND select.
 * tone 'light' = N00 look (blue selected) · 'dark' = header bar.
 */
export interface SegmentedProps<T extends string> {
  /** read by screen readers, e.g. "Machine mode" */
  label: string
  options: readonly (T | SegmentOption<T>)[]
  value: T
  onChange: (value: T) => void
  tone?: 'light' | 'dark'
  className?: string
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'light',
  className = ''
}: SegmentedProps<T>): React.JSX.Element {
  const items: SegmentOption<T>[] = options.map((o) => (typeof o === 'string' ? { value: o } : o))
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(
    0,
    items.findIndex((i) => i.value === value)
  )

  function onKeyDown(e: React.KeyboardEvent): void {
    const to = nextIndex(
      e.key,
      current,
      items.map((i) => !!i.disabled)
    )
    if (to === null) return
    e.preventDefault() // arrows must not scroll the page
    onChange(items[to].value)
    refs.current[to]?.focus()
  }

  return (
    <div className={['seg', `seg-${tone}`, className].filter(Boolean).join(' ')} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((it, i) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === current ? 0 : -1} // only the selected segment is a Tab stop
            disabled={it.disabled}
            className="seg-item"
            onClick={() => onChange(it.value)}
          >
            {it.label ?? it.value}
          </button>
        )
      })}
    </div>
  )
}
