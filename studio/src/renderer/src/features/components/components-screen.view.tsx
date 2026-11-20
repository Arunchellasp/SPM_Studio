import { useState } from 'react'
import type { ScreenDef } from '../../app/screens'
import { Button, type ButtonSize, type ButtonVariant } from '../../components/button.view'
import './components-screen.css'

const VARIANTS: { v: ButtonVariant; use: string }[] = [
  { v: 'primary', use: 'the one main action of an area' },
  { v: 'default', use: 'normal actions' },
  { v: 'quiet', use: 'secondary actions inside cards' },
  { v: 'ghost', use: 'link-like actions' },
  { v: 'danger', use: 'delete, abort, reset data' }
]
const SIZES: ButtonSize[] = ['sm', 'md', 'lg']

/**
 * N00 Components — developer screen that shows every shared building block.
 * Only visible in development builds (npm run dev). It grows with each step.
 */
export function ComponentsScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const [clicks, setClicks] = useState(0)

  return (
    <section className="cmp">
      <h1>
        <span className="cmp-code">{screen.code}</span> {screen.title}
      </h1>
      <p className="cmp-purpose">{screen.purpose}</p>

      <div className="cmp-block">
        <h2>Button · variants</h2>
        <div className="cmp-row">
          {VARIANTS.map(({ v, use }) => (
            <div key={v} className="cmp-item">
              <Button variant={v}>{v[0].toUpperCase() + v.slice(1)}</Button>
              <span className="cmp-note">{use}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cmp-block">
        <h2>Button · sizes (sm 28 · md 36 · lg 40 px)</h2>
        <div className="cmp-row">
          {SIZES.map((s) => (
            <Button key={s} variant="primary" size={s}>
              Size {s}
            </Button>
          ))}
          {SIZES.map((s) => (
            <Button key={`d-${s}`} size={s}>
              Size {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="cmp-block">
        <h2>Button · with icon, disabled, full width</h2>
        <div className="cmp-row">
          <Button variant="primary" icon="+">
            New tag
          </Button>
          <Button variant="quiet" icon="⌂">
            Home
          </Button>
          <Button variant="ghost" icon="›">
            All alarms
          </Button>
          <Button variant="primary" disabled>
            Disabled primary
          </Button>
          <Button disabled>Disabled default</Button>
        </div>
        <div className="cmp-row cmp-narrow">
          <Button variant="primary" block>
            Full width (block)
          </Button>
        </div>
      </div>

      <div className="cmp-block">
        <h2>Try it</h2>
        <div className="cmp-row">
          <Button variant="primary" onClick={() => setClicks((c) => c + 1)}>
            Click me
          </Button>
          <Button variant="danger" onClick={() => setClicks(0)} disabled={clicks === 0}>
            Reset
          </Button>
          <span className="cmp-note">
            clicked <b>{clicks}</b> times · press Tab to see the keyboard focus ring
          </span>
        </div>
      </div>
    </section>
  )
}
