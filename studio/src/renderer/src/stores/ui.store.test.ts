import { beforeEach, describe, expect, it } from 'vitest'
import { useUi } from './ui.store'

describe('ui store', () => {
  beforeEach(() => useUi.setState({ activeScreen: 'operate', mode: 'Auto', alarms: [] }))

  it('opens a screen', () => {
    useUi.getState().openScreen('tags')
    expect(useUi.getState().activeScreen).toBe('tags')
  })

  it('changes mode', () => {
    useUi.getState().setMode('Manual')
    expect(useUi.getState().mode).toBe('Manual')
  })

  it('acknowledges only the top alarm (highest priority, wherever it is in the list)', () => {
    useUi.setState({
      alarms: [
        { code: 'W0310', text: 'Glue level low', priority: 3, time: '12:31:02', acked: false },
        { code: 'E1202', text: 'Plasma ready lost', priority: 1, time: '12:37:51', acked: false }
      ],
      events: []
    })
    useUi.getState().ackTopAlarm()
    expect(useUi.getState().alarms.map((a) => [a.code, a.acked])).toEqual([
      ['W0310', false],
      ['E1202', true]
    ])
  })

  it('starts with the sample alarms, sorted (step 14)', async () => {
    const { DEMO_OVERVIEW } = await import('../fixtures/demo')
    const { sortAlarms } = await import('../features/alarms/alarms')
    expect(sortAlarms(DEMO_OVERVIEW.alarms).map((a) => a.code)).toEqual(['E1202', 'W0310'])
  })
})
