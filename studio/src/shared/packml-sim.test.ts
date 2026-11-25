import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTING_MS, PackMachine } from './packml-sim'
import type { MachineStatus } from './packml'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('simulated machine for the mock runtime and the browser (step 32)', () => {
  it('U-32.9 Reset, Start: STOPPED → RESETTING → IDLE → STARTING → EXECUTE, each change reported; a wrong command is refused', () => {
    const seen: MachineStatus['state'][] = []
    const m = new PackMachine((s) => seen.push(s.state))
    expect(m.command('start')).toEqual({ ok: false, err: 'STATE', msg: 'Start is not possible in STOPPED (only in IDLE or HELD)' })
    expect(m.command('reset')).toEqual({ ok: true })
    vi.advanceTimersByTime(ACTING_MS)
    m.command('start')
    expect(m.acting).toBe(true)
    vi.advanceTimersByTime(ACTING_MS)
    expect(m.running).toBe(true)
    expect(seen).toEqual(['RESETTING', 'IDLE', 'STARTING', 'EXECUTE'])
    expect(m.setMode('Manual')).toEqual({
      ok: false,
      err: 'MODE',
      msg: 'the mode can change only in STOPPED, IDLE or ABORTED (now EXECUTE)'
    })
    m.command('stop')
    vi.advanceTimersByTime(ACTING_MS)
    expect(m.status).toEqual({ state: 'STOPPED', mode: 'Auto' })
    expect(m.setMode('Manual')).toEqual({ ok: true })
  })
})
