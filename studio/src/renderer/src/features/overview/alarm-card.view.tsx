import type { Alarm, MachineEvent } from '../../model/machine'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { PriorityIcon } from '../../components/priority-icon.view'
import { Table, type Column } from '../../components/table.view'
import { toast } from '../../stores/feedback.store'
import { useUi } from '../../stores/ui.store'
import { alarmStateText } from '../alarms/alarms'
import './overview.css'

/** one line of the list: an active alarm or an event */
type Row = { kind: 'alarm'; a: Alarm } | { kind: 'event'; e: MachineEvent; n: number }

/**
 * N01 bottom card (Improved design › N01): 'Active alarms (2) · Events'.
 * Alarms first (priority, newest first — the store keeps them sorted), then the events, newest first.
 * Columns as drawn: P 60 · Code 120 · Time 170 · Message 900 · State 220 · Action 200.
 */
export function AlarmCard(): React.JSX.Element {
  const alarms = useUi((s) => s.alarms)
  const events = useUi((s) => s.events)
  const ackAlarm = useUi((s) => s.ackAlarm)

  const rows: Row[] = [...alarms.map((a): Row => ({ kind: 'alarm', a })), ...events.map((e, n): Row => ({ kind: 'event', e, n }))]

  const cols: Column<Row>[] = [
    { key: 'p', header: 'P', width: 60, render: (r) => (r.kind === 'alarm' ? <PriorityIcon p={r.a.priority} /> : '') },
    { key: 'code', header: 'Code', width: 120, render: (r) => (r.kind === 'alarm' ? r.a.code : '') },
    { key: 'time', header: 'Time', width: 170, render: (r) => (r.kind === 'alarm' ? r.a.time : r.e.time) },
    { key: 'msg', header: 'Message', width: 900, render: (r) => (r.kind === 'alarm' ? r.a.text : r.e.text) },
    {
      key: 'state',
      header: 'State',
      width: 220,
      render: (r) => (r.kind === 'alarm' ? alarmStateText(r.a) : 'Event'),
      cellState: (r) => (r.kind === 'alarm' && !r.a.acked ? 'fault' : 'normal') // only unacked is red
    },
    {
      key: 'act',
      header: 'Action',
      width: 200,
      render: (r) => {
        if (r.kind === 'event') return ''
        if (!r.a.acked)
          return (
            <span className="alm-actions">
              <Button size="sm" variant="ghost" className="alm-btn" onClick={() => ackAlarm(r.a.code)} aria-label={`Ack ${r.a.code}`}>
                Ack
              </Button>
              ·{/* help texts and shelving belong to N07 Alarms (phase D); here they only say so */}
              <Button size="sm" variant="ghost" className="alm-btn" onClick={() => toast(`Help for ${r.a.code} comes with N07 Alarms`)}>
                Help
              </Button>
            </span>
          )
        return (
          <Button size="sm" variant="ghost" className="alm-btn" onClick={() => toast(`Shelving ${r.a.code} comes with N07 Alarms`)}>
            Shelve 1 h
          </Button>
        )
      }
    }
  ]

  return (
    <Card title={`Active alarms (${alarms.length})  ·  Events`} className="alm-card">
      <Table
        label="Active alarms and events"
        columns={cols}
        rows={rows}
        rowKey={(r) => (r.kind === 'alarm' ? r.a.code : `ev-${r.n}-${r.e.time}`)}
        striped
        fill
        className="alm-table"
        empty="No active alarms and no events"
      />
    </Card>
  )
}
