import { describe, expect, it } from 'vitest'
import { commandView, modeView, type CommandContext } from './machine-commands'

const at = (over: Partial<CommandContext>): CommandContext => ({ link: 'online', state: 'IDLE', mode: 'Auto', role: 'Engineer', ...over })
const enabled = (c: CommandContext): string[] => (['start', 'hold', 'stop', 'reset'] as const).filter((k) => commandView(k, c).enabled)

describe('header commands (step 32)', () => {
  it('U-32.6 which buttons are on in each state', () => {
    expect(enabled(at({ state: 'STOPPED' }))).toEqual(['reset'])
    expect(enabled(at({ state: 'IDLE' }))).toEqual(['start', 'stop'])
    expect(enabled(at({ state: 'EXECUTE' }))).toEqual(['hold', 'stop'])
    expect(enabled(at({ state: 'HELD' }))).toEqual(['start', 'stop'])
    expect(enabled(at({ state: 'STARTING' }))).toEqual(['stop'])
    expect(enabled(at({ state: 'ABORTED' }))).toEqual(['reset'])
  })

  it('U-32.7 offline turns everything off; the role and the state give the reason', () => {
    expect(enabled(at({ link: 'offline', state: 'EXECUTE' }))).toEqual([])
    expect(commandView('stop', at({ link: 'offline' })).why).toBe('Runtime OFFLINE — no commands')
    expect(enabled(at({ role: 'Viewer', state: 'EXECUTE' }))).toEqual(['stop']) // a Stop is never locked
    expect(commandView('start', at({ role: 'Viewer' })).why).toBe('Your role (Viewer) may not start the machine')
    expect(commandView('start', at({ state: 'EXECUTE' })).why).toBe('Start is not possible in EXECUTE (only in IDLE or HELD)')
    expect(commandView('start', at({})).why).toBe('Start the machine (on a held machine: continue)')
  })

  it('U-32.8 mode segments: the current one stays, others need online, role and a standing machine', () => {
    expect(modeView('Auto', at({ link: 'offline' })).enabled).toBe(true)
    expect(modeView('Manual', at({}))).toEqual({ enabled: true, why: 'Switch to Manual' })
    expect(modeView('Manual', at({ state: 'EXECUTE' })).why).toBe('the mode can change only in STOPPED, IDLE or ABORTED (now EXECUTE)')
    expect(modeView('Maintenance', at({ role: 'Technician' })).why).toBe('Your role (Technician) may not switch to Maintenance')
    expect(modeView('Manual', at({ role: 'Operator' })).enabled).toBe(false)
  })
})
