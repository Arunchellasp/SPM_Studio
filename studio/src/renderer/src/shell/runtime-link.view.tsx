import { useLive } from '../stores/live.store'
import { linkView } from './runtime-link'

/** Step 31 · runtime link in the header: own component, so 1 s status updates re-render only this. */
export function RuntimeLink(): React.JSX.Element {
  const v = linkView(useLive((s) => s.status))
  return (
    <div
      className={`header-link link-${v.tone}`}
      data-testid="runtime-link"
      data-link={v.tone}
      title={v.title}
      aria-label={`Runtime link: ${v.text}`}
    >
      <span className="link-dot" aria-hidden="true" />
      {v.text}
    </div>
  )
}
