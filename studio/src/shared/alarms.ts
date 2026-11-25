/**
 * Step 33 · alarms on the wire and the ONE rule that turns runtime events into the alarm list.
 * Runtime → studio:
 *   evt { ev:'alarms', list:[AlarmEntry…] }                         on connect (the whole active list)
 *   evt { ev:'alarm', act:'raise', code, text, priority, time }     a new alarm
 *   evt { ev:'alarm', act:'ack',   code, time, by }                 acknowledged (by = user name)
 *   evt { ev:'alarm', act:'clear', code, time }                     its condition has gone
 * Studio → runtime: cmd { op:'ack', code, user } — refused with err 'ALARM' and the reason.
 * An alarm leaves the list only when it is acknowledged AND cleared; the full ISA-18.2 states,
 * history and shelving follow with N07 (step 41).
 */
export type Priority = 1 | 2 | 3 | 4

export interface AlarmEntry {
  code: string
  text: string
  priority: Priority
  /** hh:mm:ss, machine local time */
  time: string
  acked: boolean
  /** false = the condition has gone but nobody acknowledged it yet (missing = true) */
  active?: boolean
}

export type AlarmEvent =
  | { ev: 'alarms'; list: AlarmEntry[] }
  | { ev: 'alarm'; act: 'raise'; code: string; text: string; priority: Priority; time: string }
  | { ev: 'alarm'; act: 'ack'; code: string; time: string; by: string }
  | { ev: 'alarm'; act: 'clear'; code: string; time: string }

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const prio = (v: unknown): v is Priority => v === 1 || v === 2 || v === 3 || v === 4
const entry = (v: unknown): v is AlarmEntry => {
  const a = v as AlarmEntry
  return !!a && str(a.code) && typeof a.text === 'string' && prio(a.priority) && str(a.time) && typeof a.acked === 'boolean'
}

/** a runtime event → an alarm event, or null (not an alarm event, or a malformed one: ignored) */
export function alarmFrom(e: { ev: string; [k: string]: unknown }): AlarmEvent | null {
  if (e.ev === 'alarms') return Array.isArray(e.list) && e.list.every(entry) ? { ev: 'alarms', list: e.list as AlarmEntry[] } : null
  if (e.ev !== 'alarm' || !str(e.code) || !str(e.time)) return null
  if (e.act === 'raise' && typeof e.text === 'string' && prio(e.priority))
    return { ev: 'alarm', act: 'raise', code: e.code, text: e.text, priority: e.priority, time: e.time }
  if (e.act === 'ack' && str(e.by)) return { ev: 'alarm', act: 'ack', code: e.code, time: e.time, by: e.by }
  if (e.act === 'clear') return { ev: 'alarm', act: 'clear', code: e.code, time: e.time }
  return null
}

/** a line for the event list (what happened, not an alarm) */
export interface EventLine {
  time: string
  text: string
}

/** apply one alarm event: the new list (unsorted) and the event line it writes, if any */
export function applyAlarm(list: readonly AlarmEntry[], e: AlarmEvent): { alarms: AlarmEntry[]; line?: EventLine } {
  if (e.ev === 'alarms') return { alarms: [...e.list] }
  const has = list.find((a) => a.code === e.code)
  switch (e.act) {
    case 'raise': // again while still in the list: it is active again, and needs a new ack
      return {
        alarms: [
          ...list.filter((a) => a.code !== e.code),
          { code: e.code, text: e.text, priority: e.priority, time: e.time, acked: false, active: true }
        ]
      }
    case 'ack':
      if (!has) return { alarms: [...list] }
      return {
        alarms: has.active === false ? list.filter((a) => a !== has) : list.map((a) => (a === has ? { ...a, acked: true } : a)),
        line: { time: e.time, text: `${e.code} acknowledged by ${e.by}` }
      }
    case 'clear':
      if (!has) return { alarms: [...list] }
      return {
        alarms: has.acked ? list.filter((a) => a !== has) : list.map((a) => (a === has ? { ...a, active: false } : a)),
        line: { time: e.time, text: `${e.code} cleared` }
      }
  }
}

/** hh:mm:ss of a Date (machine local time) */
export function clockText(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}
