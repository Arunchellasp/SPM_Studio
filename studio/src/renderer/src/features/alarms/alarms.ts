/**
 * Alarm logic (step 14): pure functions shared by the banner, the N01 list and later N07.
 */
import type { Alarm } from '../../model/machine'
import type { LinkState } from '@shared/ipc'
import { may, type Role } from '@shared/roles'

/** most important first: priority 1 before 2 …; same priority → newest first (ISA-18.2 display order) */
export function sortAlarms(alarms: readonly Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => a.priority - b.priority || b.time.localeCompare(a.time))
}

/** the alarm the banner shows: the first after sorting (undefined when there is none) */
export function topAlarm(alarms: readonly Alarm[]): Alarm | undefined {
  return sortAlarms(alarms)[0]
}

/** text of the State column; step 33: 'Cleared · unacked' = gone, but nobody acknowledged it yet */
export function alarmStateText(a: Alarm): string {
  if (a.active === false) return 'Cleared · unacked'
  return a.acked ? 'Active · acked' : 'Active · unacked'
}

/** hh:mm:ss of a Date (machine local time) — since step 33 in shared/alarms.ts (the runtime stand-ins use it too) */
export { clockText } from '@shared/alarms'

/** step 33: may this alarm be acknowledged now, and if not, why (the button's tooltip) */
export function ackView(a: Alarm, link: LinkState, role: Role): { enabled: boolean; why: string } {
  if (a.acked) return { enabled: false, why: `${a.code} is already acknowledged` }
  if (link !== 'online') return { enabled: false, why: 'Runtime OFFLINE — acknowledge when it is back' }
  if (!may(role, 'ack')) return { enabled: false, why: `Your role (${role}) may not acknowledge alarms` }
  return { enabled: true, why: `Acknowledge ${a.code}` }
}
