import type { ScreenDef } from '../../app/screens'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { PriorityIcon } from '../../components/priority-icon.view'
import { Table, type Column } from '../../components/table.view'
import { Tabs } from '../../components/tabs.view'
import type { Alarm } from '../../model/machine'
import { useLive } from '../../stores/live.store'
import { useUi } from '../../stores/ui.store'
import { ackView, alarmStateText } from './alarms'
import './alarms.css'

/** what the other tabs of the design will hold, and when */
const LATER = 'History, Top 10 and shelving come with step 41 (N07 Alarms: all alarm states, history from the database)'

/**
 * N07 Alarms (Improved design › N07): tabs Active / History / Top 10 / Shelved.
 * Step 33: the Active tab, fed by the runtime's alarm events — same order as the banner and N01
 * (priority, then newest first), Ack per row sent to the runtime. The other tabs and the detail card follow in step 41.
 */
export function AlarmsScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const alarms = useUi((s) => s.alarms)
  return (
    <div className="n07">
      <h1 className="sr-only-h1">
        {screen.code} {screen.title}
      </h1>
      <Tabs
        label="Alarm views"
        className="n07-tabs"
        tabs={[
          { id: 'active', label: `Active (${alarms.length})`, content: <ActiveList alarms={alarms} /> },
          { id: 'history', label: 'History', content: null, disabled: true, title: LATER },
          { id: 'top', label: 'Top 10', content: null, disabled: true, title: LATER },
          { id: 'shelved', label: 'Shelved', content: null, disabled: true, title: LATER }
        ]}
      />
    </div>
  )
}

function ActiveList({ alarms }: { alarms: Alarm[] }): React.JSX.Element {
  const ackAlarm = useUi((s) => s.ackAlarm)
  const role = useUi((s) => s.userRole)
  const link = useLive((s) => s.status.link)
  const cols: Column<Alarm>[] = [
    { key: 'p', header: 'P', width: 60, render: (a) => <PriorityIcon p={a.priority} /> },
    { key: 'code', header: 'Code', width: 120, render: (a) => a.code },
    { key: 'time', header: 'Time', width: 170, render: (a) => a.time },
    { key: 'msg', header: 'Message', width: 790, render: (a) => a.text },
    { key: 'state', header: 'State', width: 220, render: alarmStateText, cellState: (a) => (a.acked ? 'normal' : 'fault') },
    {
      key: 'act',
      header: 'Action',
      width: 160,
      render: (a) => {
        if (a.acked) return ''
        const v = ackView(a, link, role)
        return (
          <Button
            size="sm"
            variant="ghost"
            className="alm-btn"
            disabled={!v.enabled}
            title={v.why}
            onClick={() => ackAlarm(a.code)}
            aria-label={`Ack ${a.code}`}
          >
            Ack
          </Button>
        )
      }
    }
  ]
  return (
    <Card title={`Active alarms (${alarms.length})`} className="n07-card">
      <Table
        label="Active alarms"
        columns={cols}
        rows={alarms}
        rowKey={(a) => a.code}
        striped
        fill
        className="n07-table"
        empty="No active alarms"
      />
      {link !== 'online' && <p className="n07-note">Runtime OFFLINE — this is the last list received; it may be old.</p>}
    </Card>
  )
}
