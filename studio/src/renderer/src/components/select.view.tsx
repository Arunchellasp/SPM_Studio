import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Icon } from './icon.view'
import './field.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Select (N00): a labelled dropdown. Uses the browser's own <select>, so mouse, keyboard
 * (arrows, letters, Enter) and touch all work without extra code. Same box as Field.
 */
export interface SelectProps extends Omit<ComponentPropsWithoutRef<'select'>, 'size' | 'children'> {
  label: ReactNode
  options: SelectOption[]
  /** grey first entry shown when nothing is chosen yet, e.g. "Choose recipe…" */
  placeholder?: string
  error?: string
  hint?: string
  block?: boolean
}

export function Select({
  label,
  options,
  placeholder,
  error,
  hint,
  block = false,
  id,
  className = '',
  ...rest
}: SelectProps): React.JSX.Element {
  const autoId = useId()
  const selectId = id ?? autoId
  const msgId = `${selectId}-msg`
  const msg = error ?? hint
  const classes = ['field', error ? 'field-error' : '', block ? 'field-block' : '', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <div className="field-box">
        <select
          id={selectId}
          className="field-control select-control"
          aria-invalid={error ? true : undefined}
          aria-describedby={msg ? msgId : undefined}
          {...rest}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select-caret" aria-hidden="true">
          <Icon name="caret" />
        </span>
      </div>
      {msg && (
        <span id={msgId} className="field-msg" role={error ? 'alert' : undefined}>
          {msg}
        </span>
      )}
    </div>
  )
}
