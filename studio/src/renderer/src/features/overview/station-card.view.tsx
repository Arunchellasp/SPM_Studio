import type { Station } from '../../model/overview'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { StatePill } from '../../components/state-pill.view'
import { Table, type Column } from '../../components/table.view'
import { useUi } from '../../stores/ui.store'
import { signalRows, stepText, type SignalRow } from './station'
import './overview.css'

/** signal table columns as drawn on N01: 220 · 160 · 178 (third column: note, no header text) */
const COLS: Column<SignalRow>[] = [
  { key: 'name', header: 'Signal', width: 220 },
  { key: 'value', header: 'Value', width: 160 },
  { key: 'note', header: '', width: 178 }
]

/**
 * N01 station card (Improved design › N01): name + state pill, current step, signal table,
 * Open sequence / Station I/O. Built only from phase-A parts: Card, StatePill, Table, Button.
 */
export function StationCard({ station }: { station: Station }): React.JSX.Element {
  const openScreen = useUi((s) => s.openScreen)
  return (
    <Card title={station.title} actions={<StatePill state={station.state} size="sm" />} className="station-card">
      <div className="station-step">
        Step <b>{stepText(station)}</b>
      </div>
      <Table
        label={`${station.title} signals`}
        columns={COLS}
        rows={signalRows(station)}
        rowKey={(r) => r.name}
        rowState={(r) => r.state}
        striped
        fill
        className="station-signals"
      />
      <div className="station-actions">
        {/* the target screens are placeholders until phase E (sequence) and D (I/O) */}
        <Button variant="quiet" size="lg" className="station-btn" onClick={() => openScreen('program')}>
          Open sequence
        </Button>
        <Button variant="quiet" size="lg" className="station-btn" onClick={() => openScreen('io')}>
          Station I/O
        </Button>
      </div>
    </Card>
  )
}
