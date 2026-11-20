import { useState } from 'react'
import type { ScreenDef } from '../../app/screens'
import { Button, type ButtonSize, type ButtonVariant } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { StatePill } from '../../components/state-pill.view'
import './components-screen.css'

const VARIANTS: { v: ButtonVariant; use: string }[] = [
  { v: 'primary', use: 'the one main action of an area' },
  { v: 'default', use: 'normal actions' },
  { v: 'quiet', use: 'secondary actions inside cards' },
  { v: 'ghost', use: 'link-like actions' },
  { v: 'danger', use: 'delete, abort, reset data' }
]
const SIZES: { s: ButtonSize; use: string }[] = [
  { s: 'sm', use: '28 px · alarm banner (Ack)' },
  { s: 'md', use: '32 px · toolbars, + New tag (default)' },
  { s: 'lg', use: '36 px · inside cards (Open sequence, Home)' },
  { s: 'xl', use: '40 px · form actions (Save draft, Acknowledge)' }
]

/**
 * N00 Components — developer screen that shows every shared building block.
 * Only visible in development builds (npm run dev). It grows with each step.
 * Since step 3 the screen itself is built from Cards, like the real screens will be.
 */
export function ComponentsScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const [clicks, setClicks] = useState(0)

  return (
    <div className="cmp">
      <div className="cmp-head">
        <h1>
          <span className="cmp-code">{screen.code}</span> {screen.title}
        </h1>
        <p className="cmp-purpose">{screen.purpose}</p>
      </div>

      {/* ---------------------------------------------------------- Card (step 3) */}
      <div className="cmp-grid cmp-cards">
        <Card title="Card with a title">
          <p className="cmp-note">Bold 14 px title, 16 px from the left edge. Body has 16 px padding.</p>
        </Card>
        <Card>
          <p className="cmp-note">Card without a title: no header row, only the 16 px padding.</p>
        </Card>
        <Card title="Station 2 · Plasma clean" actions={<StatePill state="HELD" size="sm" />}>
          <p className="cmp-note">Title + actions: the state pill sits top-right, like the station cards on N01.</p>
          <div className="cmp-row">
            <Button variant="quiet" size="lg">
              Open sequence
            </Button>
            <Button variant="quiet" size="lg">
              Station I/O
            </Button>
          </div>
        </Card>
        <Card title="Padding none" padding="none" actions={<Button size="sm">Export</Button>}>
          <div className="cmp-edge">content touches the card edges (tables, canvases)</div>
        </Card>
      </div>

      {/* ---------------------------------------------------------- Button (step 2) */}
      <Card title="Button · variants (as in N00 › Buttons and inputs)">
        <div className="cmp-row">
          {VARIANTS.map(({ v, use }) => (
            <div key={v} className="cmp-item">
              <Button variant={v} size="xl">
                {v[0].toUpperCase() + v.slice(1)}
              </Button>
              <span className="cmp-note">{use}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="cmp-grid">
        <Card title="Button · sizes (heights used in the Improved design)">
          <div className="cmp-row">
            {SIZES.map(({ s, use }) => (
              <div key={s} className="cmp-item">
                <Button variant="primary" size={s}>
                  Size {s}
                </Button>
                <Button size={s}>Size {s}</Button>
                <span className="cmp-note">{use}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Button · icon, disabled, full width, try it" actions={<span className="cmp-note">clicked {clicks}×</span>}>
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
              Disabled
            </Button>
          </div>
          <div className="cmp-row">
            <Button variant="primary" onClick={() => setClicks((c) => c + 1)}>
              Click me
            </Button>
            <Button variant="danger" onClick={() => setClicks(0)} disabled={clicks === 0}>
              Reset
            </Button>
            <span className="cmp-note">press Tab to see the keyboard focus ring</span>
          </div>
          <div className="cmp-row">
            <Button variant="primary" block>
              Full width (block)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
