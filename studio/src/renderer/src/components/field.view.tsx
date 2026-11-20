import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import './field.css'

/**
 * Field (N00): a labelled text / number input with an optional unit (mm, ms, %) and error text.
 * Everything a normal <input> accepts (value, onChange, type, min, max …) is passed through.
 */
export interface FieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  label: ReactNode
  /** short unit drawn inside the box on the right, e.g. "mm" */
  unit?: string
  /** when set: red border, this text under the box, aria-invalid for screen readers */
  error?: string
  /** grey help text under the box (hidden while there is an error) */
  hint?: string
  /** stretch to the width of the parent instead of 260 px */
  block?: boolean
}

export function Field({ label, unit, error, hint, block = false, id, className = '', ...rest }: FieldProps): React.JSX.Element {
  const autoId = useId()
  const inputId = id ?? autoId // the <label for> needs the input's id
  const msgId = `${inputId}-msg`
  const msg = error ?? hint
  const classes = ['field', unit ? 'field-has-unit' : '', error ? 'field-error' : '', block ? 'field-block' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field-box">
        <input
          id={inputId}
          className="field-control"
          aria-invalid={error ? true : undefined}
          aria-describedby={msg ? msgId : undefined}
          {...rest}
        />
        {unit && (
          <span className="field-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {msg && (
        <span id={msgId} className="field-msg" role={error ? 'alert' : undefined}>
          {msg}
        </span>
      )}
    </div>
  )
}
