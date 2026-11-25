import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ackView, alarmStateText, clockText, sortAlarms, topAlarm } from './alarms'
import { useLive } from '../../stores/live.store'
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

describe('acknowledge (store) — step 33: through the runtime', () => {
  const command = vi.fn(async () => ({ ok: true }))
  beforeEach(() => {
    command.mockClear()
    vi.stubGlobal('window', { spm: { runtime: { command } } })
    useUi.setState({ userName: 'A. Engineer', alarms: [al('E1202', 1, '12:37:51'), al('W0310', 3, '12:31:02', true)], events: [] })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('U-33.7 Ack sends cmd ack with the code and the user; nothing changes until the runtime answers with evt alarm', async () => {
    useUi.getState().ackTopAlarm()
    expect(command).toHaveBeenCalledWith('ack', { code: 'E1202', user: 'A. Engineer' })
    expect(useUi.getState().alarms[0].acked).toBe(false)
    useLive.setState((s) => ({
      events: [{ ev: 'alarm', act: 'ack', code: 'E1202', time: '12:38:00', by: 'A. Engineer', ts: 1 }, ...s.events]
    }))
    const s = useUi.getState()
    expect(s.alarms[0].acked).toBe(true)
    expect(s.events[0]).toEqual({ time: '12:38:00', text: 'E1202 acknowledged by A. Engineer' })
  })

  it('U-33.8 a raise from the runtime goes in by priority; cleared + acked leaves; state text and the Ack button say why', () => {
    useLive.setState((s) => ({
      events: [{ ev: 'alarm', act: 'raise', code: 'E2104', text: 'Vacuum low', priority: 2, time: '12:40:00', ts: 2 }, ...s.events]
    }))
    expect(useUi.getState().alarms.map((a) => a.code)).toEqual(['E1202', 'E2104', 'W0310'])
    useLive.setState((s) => ({ events: [{ ev: 'alarm', act: 'clear', code: 'W0310', time: '12:41:00', ts: 3 }, ...s.events] }))
    expect(useUi.getState().alarms.map((a) => a.code)).toEqual(['E1202', 'E2104'])
    expect(alarmStateText({ ...al('x', 1, '00:00:00'), active: false })).toBe('Cleared · unacked')
    const a = al('E1202', 1, '12:37:51')
    expect(ackView(a, 'online', 'Operator')).toEqual({ enabled: true, why: 'Acknowledge E1202' })
    expect(ackView(a, 'offline', 'Operator').why).toBe('Runtime OFFLINE — acknowledge when it is back')
    expect(ackView(a, 'online', 'Viewer').why).toBe('Your role (Viewer) may not acknowledge alarms')
    expect(ackView({ ...a, acked: true }, 'online', 'Engineer').enabled).toBe(false)
  })
})
