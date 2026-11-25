import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUi } from './ui.store'
import { machineFrom, useLive } from './live.store'
import { fakeRuntime } from './test-runtime'

describe('ui store', () => {
  beforeEach(() => useUi.setState({ activeScreen: 'operate', mode: 'Auto', alarms: [] }))

  it('opens a screen', () => {
    useUi.getState().openScreen('tags')
    expect(useUi.getState().activeScreen).toBe('tags')
  })

  it('U-32.10 state and mode follow the runtime (evt machine via live.store), not a click', () => {
    useLive.setState({ machine: { state: 'EXECUTE', mode: 'Manual' } })
    expect([useUi.getState().machineState, useUi.getState().mode]).toEqual(['EXECUTE', 'Manual'])
    useUi.getState().setMode('Auto') // no runtime here: refused, nothing changes
    expect(useUi.getState().mode).toBe('Manual')
    expect(machineFrom({ ev: 'machine', ts: 0, state: 'HELD', mode: 'Auto' })).toEqual({ state: 'HELD', mode: 'Auto' })
    expect(machineFrom({ ev: 'machine', ts: 0, state: 'RUNNING', mode: 'Auto' })).toBeNull() // not a PackML state
    expect(machineFrom({ ev: 'step', ts: 0 })).toBeNull()
  })

  it('acknowledges only the top alarm (highest priority, wherever it is in the list)', () => {
    useUi.setState({
      alarms: [
        { code: 'W0310', text: 'Glue level low', priority: 3, time: '12:31:02', acked: false },
        { code: 'E1202', text: 'Plasma ready lost', priority: 1, time: '12:37:51', acked: false }
      ],
      events: []
    })
    const command = fakeRuntime() // step 33: the runtime acknowledges; the list comes back sorted
    useUi.getState().ackTopAlarm()
    expect(command).toHaveBeenCalledWith('ack', { code: 'E1202', user: useUi.getState().userName })
    expect(useUi.getState().alarms.map((a) => [a.code, a.acked])).toEqual([
      ['E1202', true],
      ['W0310', false]
    ])
    vi.unstubAllGlobals()
  })

  it('starts with the sample alarms, sorted (step 14)', async () => {
    const { DEMO_OVERVIEW } = await import('../fixtures/demo')
    const { sortAlarms } = await import('../features/alarms/alarms')
    expect(sortAlarms(DEMO_OVERVIEW.alarms).map((a) => a.code)).toEqual(['E1202', 'W0310'])
  })
})
