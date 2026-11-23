/**
 * Alarm logic (step 14): pure functions shared by the banner, the N01 list and later N07.
 */
import type { Alarm } from '../../model/machine'

/** most important first: priority 1 before 2 …; same priority → newest first (ISA-18.2 display order) */
export function sortAlarms(alarms: readonly Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => a.priority - b.priority || b.time.localeCompare(a.time))
}

/** the alarm the banner shows: the first after sorting (undefined when there is none) */
export function topAlarm(alarms: readonly Alarm[]): Alarm | undefined {
  return sortAlarms(alarms)[0]
}

/** text of the State column */
export function alarmStateText(a: Alarm): string {
  return a.acked ? 'Active · acked' : 'Active · unacked'
}

/** hh:mm:ss of a Date (machine local time) — for events written by the HMI itself */
export function clockText(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}
