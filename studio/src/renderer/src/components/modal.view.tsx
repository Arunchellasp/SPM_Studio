import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './button.view'
import { Icon } from './icon.view'
import './dialog.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  title: string
  onClose: () => void
  /** the buttons at the bottom (Cancel / OK …) */
  actions: ReactNode
  children: ReactNode
}

/**
 * A dialog with its own content (step 19, first use: the address picker). Same look and keyboard rules
 * as the confirm dialog (step 8): focus goes to the first field, Tab stays inside, Esc closes,
 * focus goes back to where it was. Rendered only while open: {open && <Modal …/>}.
 */
export function Modal({ title, onClose, actions, children }: ModalProps): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('.dlg-body ' + FOCUSABLE.split(', ').join(', .dlg-body '))?.focus()
    return () => before?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !box.current) return
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="dlg" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <header className="dlg-head">
          <h2 id={titleId} className="dlg-title">
            {title}
          </h2>
          <Button variant="ghost" size="sm" className="dlg-x" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </header>
        <div className="dlg-body">{children}</div>
        <footer className="dlg-actions">{actions}</footer>
      </div>
    </div>
  )
}
