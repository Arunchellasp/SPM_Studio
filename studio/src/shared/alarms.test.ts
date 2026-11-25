import { describe, expect, it } from 'vitest'
import { alarmFrom, applyAlarm, type AlarmEntry } from './alarms'

const E1202: AlarmEntry = { code: 'E1202', text: 'Plasma ready signal lost', priority: 1, time: '12:37:51', acked: false, active: true }
const W0310: AlarmEntry = { code: 'W0310', text: 'Glue level low', priority: 3, time: '12:31:02', acked: true, active: true }

describe('alarm events → alarm list (step 33)', () => {
  it('U-33.1 snapshot on connect replaces the list; raise adds an unacked alarm', () => {
    expect(applyAlarm([E1202], { ev: 'alarms', list: [W0310] }).alarms).toEqual([W0310])
    const r = applyAlarm([W0310], {
      ev: 'alarm',
      act: 'raise',
      code: 'E1202',
      text: 'Plasma ready signal lost',
      priority: 1,
      time: '12:37:51'
    })
    expect(r).toEqual({ alarms: [W0310, E1202] })
  })

  it('U-33.2 ack and clear: the alarm leaves only when both happened; each writes an event line', () => {
    const acked = applyAlarm([E1202], { ev: 'alarm', act: 'ack', code: 'E1202', time: '12:38:00', by: 'A. Engineer' })
    expect(acked.alarms).toEqual([{ ...E1202, acked: true }])
    expect(acked.line).toEqual({ time: '12:38:00', text: 'E1202 acknowledged by A. Engineer' })
    expect(applyAlarm(acked.alarms, { ev: 'alarm', act: 'clear', code: 'E1202', time: '12:39:00' })).toEqual({
      alarms: [],
      line: { time: '12:39:00', text: 'E1202 cleared' }
    })
    // cleared first: stays as 'cleared · unacked' until somebody acknowledges it
    const cleared = applyAlarm([E1202], { ev: 'alarm', act: 'clear', code: 'E1202', time: '12:39:00' })
    expect(cleared.alarms).toEqual([{ ...E1202, active: false }])
    expect(applyAlarm(cleared.alarms, { ev: 'alarm', act: 'ack', code: 'E1202', time: '12:40:00', by: 'S. Devi' }).alarms).toEqual([])
  })

  it('U-33.3 a raise of an alarm still in the list makes it active and unacked again; unknown codes change nothing', () => {
    const again = applyAlarm([{ ...E1202, acked: true, active: false }], {
      ev: 'alarm',
      act: 'raise',
      code: 'E1202',
      text: 'Plasma ready signal lost',
      priority: 1,
      time: '12:41:00'
    })
    expect(again.alarms).toEqual([{ ...E1202, time: '12:41:00' }])
    expect(applyAlarm([W0310], { ev: 'alarm', act: 'ack', code: 'X9999', time: '12:00:00', by: 'x' })).toEqual({ alarms: [W0310] })
  })

  it('U-33.4 events from the wire are checked; anything malformed is ignored', () => {
    expect(alarmFrom({ ev: 'alarm', act: 'raise', code: 'E1', text: 't', priority: 1, time: '12:00:00', ts: 0 })).toMatchObject({
      act: 'raise'
    })
    expect(alarmFrom({ ev: 'alarm', act: 'raise', code: 'E1', text: 't', priority: 7, time: '12:00:00' })).toBeNull() // no P7
    expect(alarmFrom({ ev: 'alarm', act: 'ack', code: 'E1', time: '12:00:00' })).toBeNull() // who?
    expect(alarmFrom({ ev: 'alarms', list: [W0310, { code: 'x' }] })).toBeNull()
    expect(alarmFrom({ ev: 'machine', state: 'IDLE' })).toBeNull()
  })
})
