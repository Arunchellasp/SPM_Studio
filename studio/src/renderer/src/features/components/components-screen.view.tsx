import { useState } from 'react'
import type { ScreenDef } from '../../app/screens'
import { Button, type ButtonSize, type ButtonVariant } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Field } from '../../components/field.view'
import { Select, type SelectOption } from '../../components/select.view'
import { StatePill } from '../../components/state-pill.view'
import './components-screen.css'

const VARIANTS: { v: ButtonVariant; use: string }[] = [
  { v: 'primary', use: 'the one main action of an area' },
  { v: 'default', use: 'normal actions' },
  { v: 'quiet', use: 'secondary actions inside cards' },
  { v: 'ghost', use: 'link-like actions' },
  { v: 'danger', use: 'delete, abort, reset data' }
]
const RECIPES: SelectOption[] = [
  { value: 'A-12', label: 'Recipe A-12' },
  { value: 'A-13', label: 'Recipe A-13' },
  { value: 'B-01', label: 'Recipe B-01' },
  { value: 'old', label: 'Recipe X-00 (archived)', disabled: true }
]

/** demo rule for the position field: a number from 0 to 600 mm */
function checkPosition(text: string): string | undefined {
  if (text.trim() === '') return 'Enter a position'
  const n = Number(text)
  if (Number.isNaN(n)) return 'Not a number'
  if (n < 0 || n > 600) return 'Allowed range 0 … 600 mm'
  return undefined
}

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
  const [position, setPosition] = useState('482.382')
  const [recipe, setRecipe] = useState('A-12')
  const [speed, setSpeed] = useState('')
  const positionError = checkPosition(position)

  return (
    <div className="cmp">
      <div className="cmp-head">
        <h1>
          <span className="cmp-code">{screen.code}</span> {screen.title}
        </h1>
        <p className="cmp-purpose">{screen.purpose}</p>
      </div>

      {/* ---------------------------------------------------------- Field + Select (step 4) */}
      <Card
        title="Field + Select (as in N00 › Buttons and inputs)"
        actions={
          <span className="cmp-note" data-testid="form-echo">
            position {positionError ? '—' : `${position} mm`} · recipe {recipe}
          </span>
        }
      >
        <div className="cmp-row cmp-fields">
          <Field
            label="Target position"
            unit="mm"
            inputMode="decimal"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            error={positionError}
          />
          <Select label="Recipe" options={RECIPES} value={recipe} onChange={(e) => setRecipe(e.target.value)} />
          <Field
            label="Jog speed"
            unit="mm/s"
            placeholder="e.g. 50"
            hint="Empty = machine default"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
          <Select
            label="Axis (choose)"
            placeholder="Choose axis…"
            defaultValue=""
            options={[
              { value: 'X1', label: 'Slide X1' },
              { value: 'X2', label: 'Slide X2' }
            ]}
          />
          <Field label="Cycle counter (read only)" value="12 480" disabled />
        </div>
        <p className="cmp-note">
          Type a value above 600 or a letter in “Target position” to see the error state. Tab moves between boxes; in a select use ↑ ↓ or
          the first letter.
        </p>
      </Card>

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
