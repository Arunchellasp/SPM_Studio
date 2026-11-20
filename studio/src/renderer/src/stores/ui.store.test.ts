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

  it('acknowledges only the first alarm', () => {
    useUi.setState({
      alarms: [
        { code: 'E1202', text: 'Plasma ready lost', priority: 1, time: '12:37:51', acked: false },
        { code: 'W0310', text: 'Glue level low', priority: 3, time: '12:31:02', acked: false }
      ]
    })
    useUi.getState().ackTopAlarm()
    expect(useUi.getState().alarms.map((a) => a.acked)).toEqual([true, false])
  })
})
