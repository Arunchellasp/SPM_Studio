import { Button } from '../components/button.view'
import { PriorityIcon } from '../components/priority-icon.view'
import { ackView, topAlarm } from '../features/alarms/alarms'
import { useLive } from '../stores/live.store'
import { useUi } from '../stores/ui.store'

/**
 * Alarm banner (36 px, bottom): the highest-priority active alarm is always visible,
 * acknowledge in one click. Grey "No active alarms" when everything is fine.
 * Step 33: the alarms come from the runtime, and Ack is a command to it.
 */
export function AlarmBanner(): React.JSX.Element {
  const alarms = useUi((s) => s.alarms)
  const ack = useUi((s) => s.ackTopAlarm)
  const openScreen = useUi((s) => s.openScreen)
  const role = useUi((s) => s.userRole)
  const link = useLive((s) => s.status.link)

  if (alarms.length === 0) {
    return <footer className="banner banner-ok">No active alarms</footer>
  }

  const top = topAlarm(alarms)! // same order as the N01 list and N07 (step 14)
  const more = alarms.length - 1
  const v = ackView(top, link, role) // step 33: Ack goes to the runtime — online, role, not yet acked

  return (
    <footer className="banner banner-alarm" role="alert">
      <PriorityIcon p={top.priority} />
      <span className="banner-text">
        <b>{top.code}</b> {top.text} · {top.time}
        {more > 0 && ` · ${more} more active`}
      </span>
      <Button size="sm" disabled={!v.enabled} title={v.why} onClick={ack} aria-label={`Acknowledge ${top.code}`}>
        Ack
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openScreen('alarms')}>
        All alarms
      </Button>
    </footer>
  )
}
