import { describe, expect, it } from 'vitest'
import { ACTING, changeMode, command, settle, WAIT_STATES, type PackState } from './packml'
import { may, ROLES } from './roles'

/** run commands from a state, letting each acting state finish: the wait state reached */
const run = (from: PackState, ...cmds: Parameters<typeof command>[1][]): PackState =>
  cmds.reduce<PackState>((s, c) => {
    const r = command(s, c)
    if (!r.ok) throw new Error(r.reason)
    return settle(r.next)
  }, from)

describe('PackML model (step 32)', () => {
  it('U-32.1 command → state: the transitions of the design', () => {
    expect(command('IDLE', 'start')).toEqual({ ok: true, next: 'STARTING' })
    expect(settle('STARTING')).toBe('EXECUTE')
    expect(run('STOPPED', 'reset', 'start')).toBe('EXECUTE')
    expect(run('EXECUTE', 'hold')).toBe('HELD')
    expect(command('HELD', 'start')).toEqual({ ok: true, next: 'UNHOLDING' }) // Start = Unhold
    expect(run('HELD', 'start')).toBe('EXECUTE')
    expect(run('ABORTED', 'reset')).toBe('STOPPED') // Reset = Clear
    expect(run('COMPLETE', 'reset')).toBe('IDLE')
    expect(settle('EXECUTE')).toBe('EXECUTE') // a wait state stays
  })

  it('U-32.2 Stop from every state except STOPPED and the abort group', () => {
    const states = [...WAIT_STATES, ...Object.keys(ACTING)] as PackState[]
    const stoppable = states.filter((s) => command(s, 'stop').ok)
    expect(states.filter((s) => !stoppable.includes(s)).sort()).toEqual(['ABORTED', 'ABORTING', 'CLEARING', 'STOPPED', 'STOPPING'])
    expect(run('HELD', 'stop')).toBe('STOPPED')
  })

  it('U-32.3 refused commands say where they are possible', () => {
    expect(command('EXECUTE', 'start')).toEqual({ ok: false, reason: 'Start is not possible in EXECUTE (only in IDLE or HELD)' })
    expect(command('STOPPED', 'start')).toEqual({ ok: false, reason: 'Start is not possible in STOPPED (only in IDLE or HELD)' })
    expect(command('IDLE', 'hold')).toEqual({ ok: false, reason: 'Hold is not possible in IDLE (only in EXECUTE)' })
    expect(command('EXECUTE', 'reset').ok).toBe(false)
    expect(command('STOPPED', 'stop').ok).toBe(false)
  })

  it('U-32.4 the mode changes only while the machine stands', () => {
    expect(changeMode('STOPPED', 'Manual')).toEqual({ ok: true })
    expect(changeMode('IDLE', 'Maintenance')).toEqual({ ok: true })
    expect(changeMode('EXECUTE', 'Manual')).toEqual({
      ok: false,
      reason: 'the mode can change only in STOPPED, IDLE or ABORTED (now EXECUTE)'
    })
  })

  it('U-32.5 roles: Stop for everyone; Start / Hold / Reset from Operator up; mode from Technician, Maintenance only Engineer', () => {
    expect(ROLES.filter((r) => may(r, 'stop'))).toEqual(['Viewer', 'Operator', 'Technician', 'Engineer'])
    expect(ROLES.filter((r) => may(r, 'start'))).toEqual(['Operator', 'Technician', 'Engineer'])
    expect(ROLES.filter((r) => may(r, 'mode:Manual'))).toEqual(['Technician', 'Engineer'])
    expect(ROLES.filter((r) => may(r, 'mode:Maintenance'))).toEqual(['Engineer'])
  })
})
