import { useState } from 'react'
import type { ScreenDef } from '../../app/screens'
import { Button, type ButtonSize, type ButtonVariant } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Field } from '../../components/field.view'
import { Icon } from '../../components/icon.view'
import { confirmDialog, toast } from '../../stores/feedback.store'
import { useScreenScale } from '../../app/screen-scale'
import { Segmented } from '../../components/segmented.view'
import { Select, type SelectOption } from '../../components/select.view'
import { Tabs } from '../../components/tabs.view'
import { Table, type Column, type ValueState } from '../../components/table.view'
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

/** N00 › Value states: the three rows exactly as drawn */
interface StateRow {
  tag: string
  value: string
  state: ValueState
  note: string
}
const STATE_ROWS: StateRow[] = [
  { tag: 'Plasma.Ready', value: 'TRUE', state: 'normal', note: 'normal (no colour)' },
  { tag: 'Clamp.Fwd', value: 'TRUE', state: 'forced', note: 'forced: amber + ⓕ' },
  { tag: 'Axis2.Pos', value: 'ERR', state: 'fault', note: 'bad quality / fault' }
]
const STATE_COLS: Column<StateRow>[] = [
  { key: 'tag', header: 'Tag', width: 220 },
  { key: 'value', header: 'Value', width: 140 },
  { key: 'note', header: 'State', width: 220 }
]

/** N03 Tags style: 5 columns, comment left-aligned; the force button changes the row state */
interface TagRow {
  tag: string
  type: string
  value: string
  comment: string
  fault?: boolean
}
const TAG_ROWS: TagRow[] = [
  { tag: 'Station.ClampOut', type: 'BOOL', value: 'TRUE', comment: 'Clamp solenoid O0.04' },
  { tag: 'Station.ClampFwd', type: 'BOOL', value: 'TRUE', comment: 'Clamp forward sensor I0.02' },
  { tag: 'Station.Settle', type: 'TIME', value: '300 ms', comment: 'Recipe value' },
  { tag: 'Axis2.Pos', type: 'REAL', value: 'ERR', comment: 'Encoder cable fault', fault: true },
  { tag: 'Plasma.Ready', type: 'BOOL', value: 'FALSE', comment: 'Generator ready' }
]
type TagFilter = 'All' | 'Forced' | 'Fault'

type DemoMode = 'Auto' | 'Manual' | 'Maint.'
const DEMO_MODES: readonly DemoMode[] = ['Auto', 'Manual', 'Maint.']

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
  const [demoMode, setDemoMode] = useState<DemoMode>('Auto')
  const [view, setView] = useState<'list' | 'grid' | 'chart'>('list')
  const [tab, setTab] = useState('overview')
  const [answer, setAnswer] = useState('–')
  const scale = useScreenScale()

  async function deleteRecipe(): Promise<void> {
    const ok = await confirmDialog({
      title: 'Delete recipe A-13?',
      message: 'The recipe and its 12 parameter values are removed.\nThis cannot be undone.',
      confirmLabel: 'Delete',
      danger: true
    })
    setAnswer(ok ? 'Delete' : 'Cancel')
    if (ok) toast('Recipe A-13 deleted', 'done')
  }
  async function saveDraft(): Promise<void> {
    const ok = await confirmDialog({
      title: 'Save draft?',
      message: 'Save the changed values of recipe A-12 as a draft.',
      confirmLabel: 'Save draft'
    })
    setAnswer(ok ? 'Save draft' : 'Cancel')
    if (ok) toast('Draft saved', 'done')
  }
  const [forced, setForced] = useState<string[]>(['Station.ClampFwd'])
  const [filter, setFilter] = useState<TagFilter>('All')
  const tagState = (r: TagRow): ValueState => (r.fault ? 'fault' : forced.includes(r.tag) ? 'forced' : 'normal')
  const toggleForce = (tag: string): void => setForced((f) => (f.includes(tag) ? f.filter((t) => t !== tag) : [...f, tag]))
  const shownTags = TAG_ROWS.filter((r) => filter === 'All' || tagState(r) === filter.toLowerCase())
  const tagCols: Column<TagRow>[] = [
    { key: 'tag', header: 'Tag', width: 260, align: 'left' },
    { key: 'type', header: 'Type', width: 100 },
    { key: 'value', header: 'Value', width: 120 },
    { key: 'comment', header: 'Comment', width: 280, align: 'left' },
    {
      key: 'force',
      header: 'Force',
      width: 120,
      render: (r) =>
        r.fault ? (
          '–'
        ) : (
          <Button
            size="sm"
            variant={forced.includes(r.tag) ? 'default' : 'quiet'}
            icon={forced.includes(r.tag) ? undefined : <Icon name="forced" />}
            onClick={() => toggleForce(r.tag)}
          >
            {forced.includes(r.tag) ? 'Release' : 'Force'}
          </Button>
        )
    }
  ]

  return (
    <div className="cmp">
      <div className="cmp-head">
        <h1>
          <span className="cmp-code">{screen.code}</span> {screen.title}
        </h1>
        <p className="cmp-purpose">{screen.purpose}</p>
        <p className="cmp-note" data-testid="scale-echo">
          window {Math.round(scale.width * scale.zoom)} × {Math.round(scale.height * scale.zoom)} px · zoom {Math.round(scale.zoom * 100)} %
          · layout {scale.width} × {scale.height} design px
        </p>
      </div>

      {/* ---------------------------------------------------------- Dialog + toast (step 8) */}
      <Card
        title="Dialog + toast (in-app, never the browser's alert)"
        actions={
          <span className="cmp-note" data-testid="dlg-echo">
            answer {answer}
          </span>
        }
      >
        <div className="cmp-row">
          <Button variant="danger" onClick={deleteRecipe}>
            Delete recipe…
          </Button>
          <Button variant="primary" onClick={saveDraft}>
            Save draft…
          </Button>
          <Button variant="quiet" icon={<Icon name="info" />} onClick={() => toast('Recipe A-12 loaded')}>
            Info toast
          </Button>
          <Button variant="quiet" icon={<Icon name="error" />} onClick={() => toast('Export failed: USB stick not found', 'error')}>
            Error toast
          </Button>
          <span className="cmp-note">
            Dialog: Tab / Shift+Tab stay inside, Esc = Cancel, Enter = focused button. Toasts hide after 4 s (bottom-right).
          </span>
        </div>
      </Card>

      {/* ---------------------------------------------------------- Table (step 6) */}
      <div className="cmp-grid cmp-tables">
        <Card title="Table · value states (as in N00 › Value states)">
          <Table label="Value states" columns={STATE_COLS} rows={STATE_ROWS} rowKey={(r) => r.tag} rowState={(r) => r.state} />
          <p className="cmp-note cmp-gap">
            Colour only when a person must look: amber + ⓕ = forced by a person, light red = bad value / fault.
          </p>
        </Card>
        <Card
          title="Table · tag list (like N03 Tags)"
          actions={
            <>
              <span className="cmp-note" data-testid="tbl-echo">
                {shownTags.length} {shownTags.length === 1 ? 'row' : 'rows'} · {forced.length} forced
              </span>
              <Segmented label="Tag filter" options={['All', 'Forced', 'Fault'] as const} value={filter} onChange={setFilter} />
            </>
          }
        >
          <Table
            label="Tags"
            columns={tagCols}
            rows={shownTags}
            rowKey={(r) => r.tag}
            rowState={tagState}
            striped
            empty="No tags match the filter"
          />
        </Card>
      </div>

      {/* ---------------------------------------------------------- Segmented + Tabs (step 5) */}
      <div className="cmp-grid">
        <Card
          title="Segmented (as in N00 › Buttons and inputs)"
          actions={
            <span className="cmp-note" data-testid="seg-echo">
              mode {demoMode} · view {view}
            </span>
          }
        >
          <div className="cmp-row">
            <Segmented label="Demo mode" options={DEMO_MODES} value={demoMode} onChange={setDemoMode} />
            <span className="cmp-note">110 × 32 segments · the header mode switch is the same component (dark)</span>
          </div>
          <div className="cmp-row">
            <Segmented
              label="View"
              options={[
                { value: 'list', label: 'List' },
                { value: 'grid', label: 'Grid' },
                { value: 'chart', label: 'Chart (later)', disabled: true }
              ]}
              value={view}
              onChange={setView}
            />
            <span className="cmp-note">a disabled option is skipped by the arrow keys</span>
          </div>
          <p className="cmp-note cmp-gap">Click a segment, or press Tab to reach the group and use ← → (selection follows the arrow).</p>
        </Card>

        <Card
          title="Tabs (as in N00 › Buttons and inputs)"
          actions={
            <span className="cmp-note" data-testid="tab-echo">
              tab {tab}
            </span>
          }
        >
          <Tabs
            label="Station view"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: <p className="cmp-note">Overview panel: state, counters and the 'why not faster' card go here (N01).</p>
              },
              { id: 'stations', label: 'Stations', content: <p className="cmp-note">Stations panel: one card per station.</p> },
              { id: 'axes', label: 'Axes', content: <p className="cmp-note">Axes panel: position, jog and home per axis (step 30+).</p> },
              { id: 'io', label: 'I/O', content: <p className="cmp-note">I/O panel: input and output lamps (step 25+).</p> },
              { id: 'trace', label: 'Trace', content: null, disabled: true }
            ]}
          />
        </Card>
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
            <Button variant="primary" icon={<Icon name="plus" />}>
              New tag
            </Button>
            <Button variant="quiet" icon={<Icon name="home" />}>
              Home
            </Button>
            <Button variant="ghost" icon={<Icon name="next" />}>
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
