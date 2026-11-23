import { beforeEach, describe, expect, it } from 'vitest'
import { alarmStateText, clockText, sortAlarms, topAlarm } from './alarms'
import { useUi } from '../../stores/ui.store'
import type { Alarm } from '../../model/machine'

const al = (code: string, priority: 1 | 2 | 3 | 4, time: string, acked = false): Alarm => ({ code, text: code, priority, time, acked })

describe('alarm order (priority, then newest first)', () => {
  it('sorts by priority first', () => {
    expect(sortAlarms([al('W3', 3, '12:00:00'), al('E1', 1, '11:00:00'), al('W2', 2, '13:00:00')]).map((a) => a.code)).toEqual([
      'E1',
      'W2',
      'W3'
    ])
  })
  it('same priority: newest first', () => {
    expect(sortAlarms([al('a', 2, '10:00:00'), al('b', 2, '12:30:00'), al('c', 2, '11:15:00')]).map((a) => a.code)).toEqual(['b', 'c', 'a'])
  })
  it('does not change the list it gets', () => {
    const list = [al('W3', 3, '12:00:00'), al('E1', 1, '11:00:00')]
    sortAlarms(list)
    expect(list.map((a) => a.code)).toEqual(['W3', 'E1'])
  })
  it('top alarm = first after sorting; none for an empty list', () => {
    expect(topAlarm([al('W3', 3, '12:00:00'), al('E1', 1, '11:00:00')])?.code).toBe('E1')
    expect(topAlarm([])).toBeUndefined()
  })
  it('state text and clock text', () => {
    expect(alarmStateText(al('x', 1, '00:00:00'))).toBe('Active · unacked')
    expect(alarmStateText(al('x', 1, '00:00:00', true))).toBe('Active · acked')
    expect(clockText(new Date(2026, 10, 23, 9, 5, 7))).toBe('09:05:07')
  })
})

describe('acknowledge (store)', () => {
  beforeEach(() =>
    useUi.setState({ userName: 'A. Engineer', alarms: [al('E1202', 1, '12:37:51'), al('W0310', 3, '12:31:02', true)], events: [] })
  )

  it('ackAlarm marks it acked and writes an event (who, what, when)', () => {
    useUi.getState().ackAlarm('E1202')
    const s = useUi.getState()
    expect(s.alarms[0].acked).toBe(true)
    expect(s.events[0].text).toBe('E1202 acknowledged by A. Engineer')
    expect(s.events[0].time).toMatch(/^\d\d:\d\d:\d\d$/)
  })
  it('acking twice or an unknown code changes nothing (no double event)', () => {
    useUi.getState().ackAlarm('E1202')
    useUi.getState().ackAlarm('E1202')
    useUi.getState().ackAlarm('X9999')
    expect(useUi.getState().events).toHaveLength(1)
  })
})
