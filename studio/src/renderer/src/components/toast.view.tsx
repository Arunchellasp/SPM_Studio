import { useFeedback, type ToastKind } from '../stores/feedback.store'
import { Button } from './button.view'
import { Icon, type IconName } from './icon.view'
import './toast.css'

const ICON: Record<ToastKind, IconName> = { info: 'info', done: 'done', error: 'error' }

/**
 * ToastHost: placed once in the shell. Shows the toasts from the feedback store.
 * role="status" + aria-live: screen readers read a new toast without moving the focus.
 * Toasts are for "it happened" messages; anything the operator MUST act on is an alarm, not a toast.
 */
export function ToastHost(): React.JSX.Element {
  const toasts = useFeedback((s) => s.toasts)
  const dismiss = useFeedback((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={ICON[t.kind]} className="toast-icon" />
          <span className="toast-text">{t.text}</span>
          <Button variant="ghost" size="sm" className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <Icon name="close" />
          </Button>
        </div>
      ))}
    </div>
  )
}
