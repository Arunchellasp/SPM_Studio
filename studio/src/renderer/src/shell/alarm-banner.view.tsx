import { Button } from '../components/button.view'
import { PriorityIcon } from '../components/priority-icon.view'
import { topAlarm } from '../features/alarms/alarms'
import { useUi } from '../stores/ui.store'

/**
 * Alarm banner (36 px, bottom): the highest-priority active alarm is always visible,
 * acknowledge in one click. Grey "No active alarms" when everything is fine.
 */
export function AlarmBanner(): React.JSX.Element {
  const alarms = useUi((s) => s.alarms)
  const ack = useUi((s) => s.ackTopAlarm)
  const openScreen = useUi((s) => s.openScreen)

  if (alarms.length === 0) {
    return <footer className="banner banner-ok">No active alarms</footer>
  }

  const top = topAlarm(alarms)! // same order as the N01 list and N07 (step 14)
  const more = alarms.length - 1

  return (
    <footer className="banner banner-alarm" role="alert">
      <PriorityIcon p={top.priority} />
      <span className="banner-text">
        <b>{top.code}</b> {top.text} · {top.time}
        {more > 0 && ` · ${more} more active`}
      </span>
      <Button size="sm" disabled={top.acked} onClick={ack} aria-label={`Acknowledge ${top.code}`}>
        Ack
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openScreen('alarms')}>
        All alarms
      </Button>
    </footer>
  )
}
