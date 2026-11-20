import { useEffect, useId, useRef } from 'react'
import { useFeedback } from '../stores/feedback.store'
import { Button } from './button.view'
import { Icon } from './icon.view'
import './dialog.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * ConfirmDialogHost: placed once in the shell. Shows the question from the feedback store.
 * Keyboard: focus starts on Cancel (the safe answer), Tab / Shift+Tab stay inside, Esc = cancel,
 * Enter presses the focused button. When it closes, focus goes back to where it was.
 */
export function ConfirmDialogHost(): React.JSX.Element | null {
  const dialog = useFeedback((s) => s.dialog)
  const close = useFeedback((s) => s.closeDialog)
  const box = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const msgId = useId()

  useEffect(() => {
    if (!dialog) return
    const before = document.activeElement as HTMLElement | null // to give focus back later
    cancelRef.current?.focus()
    return () => before?.focus()
  }, [dialog])

  if (!dialog) return null

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(false)
      return
    }
    if (e.key !== 'Tab' || !box.current) return
    // focus trap: wrap around at the ends instead of leaving the dialog
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
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div
        ref={box}
        className="dlg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={msgId}
        onKeyDown={onKeyDown}
      >
        <header className="dlg-head">
          <h2 id={titleId} className="dlg-title">
            {dialog.title}
          </h2>
          <Button variant="ghost" size="sm" className="dlg-x" aria-label="Close" onClick={() => close(false)}>
            <Icon name="close" />
          </Button>
        </header>
        <p id={msgId} className="dlg-body">
          {dialog.message}
        </p>
        <footer className="dlg-actions">
          <Button ref={cancelRef} size="xl" onClick={() => close(false)}>
            {dialog.cancelLabel ?? 'Cancel'}
          </Button>
          <Button size="xl" variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {dialog.confirmLabel ?? 'OK'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
