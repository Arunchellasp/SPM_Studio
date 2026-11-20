import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import './card.css'

/**
 * Card (N00): the white panel used on almost every screen.
 * Optional title (bold 14 px, top-left) and action area (top-right: state pill, buttons).
 */
export interface CardProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  title?: ReactNode
  actions?: ReactNode
  /** 'md' = 16 px inside the card (default) · 'none' = content touches the edges (tables, canvases) */
  padding?: 'md' | 'none'
  /** stretch to the full height of the parent (e.g. a screen with one big card) */
  fill?: boolean
}

export function Card({ title, actions, padding = 'md', fill = false, className = '', children, ...rest }: CardProps): React.JSX.Element {
  const titleId = useId() // unique id so screen readers can name the card by its title
  const hasHead = title !== undefined || actions !== undefined
  const classes = ['card', fill ? 'card-fill' : '', className].filter(Boolean).join(' ')

  return (
    <section className={classes} aria-labelledby={title !== undefined ? titleId : undefined} {...rest}>
      {hasHead && (
        <header className="card-head">
          {title !== undefined && (
            <h3 id={titleId} className="card-title">
              {title}
            </h3>
          )}
          {actions !== undefined && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={`card-body card-pad-${padding}`}>{children}</div>
    </section>
  )
}
