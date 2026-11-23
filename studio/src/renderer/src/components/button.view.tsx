import type { ComponentPropsWithRef, ReactNode } from 'react'
import './button.css'

/** The 5 button styles of N00. Pick by meaning, not by colour. */
export type ButtonVariant =
  | 'primary' // the one main action of an area (Move to target, + New tag)
  | 'default' // normal actions (Save draft, Ack)
  | 'quiet' // secondary actions inside cards (Open sequence, Home)
  | 'ghost' // link-like actions (All alarms)
  | 'danger' // actions that destroy or stop something (Delete, Abort)

/** Heights from the design: sm 28 (banner) · md 32 (toolbars, default) · lg 36 (inside cards) · xl 40 (form actions) */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Everything a normal <button> accepts (onClick, disabled, title, type …) plus
 * variant, size and an optional icon. Unknown props are passed straight through.
 */
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  // WithRef: a screen may hold a ref to the button (React 19 passes ref like any prop), e.g. to focus it
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  /** stretch to the width of the parent */
  block?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  block = false,
  type = 'button', // never submit a form by accident
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  // icon only (no text, e.g. Undo / Redo — step 21): square, without the minimum width of a text button
  const square = icon !== undefined && (children === undefined || children === null || children === false)
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', square ? 'btn-square' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon && (
        <span className="btn-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}
