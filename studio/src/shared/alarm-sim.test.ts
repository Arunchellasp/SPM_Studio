import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlarmBook } from './alarm-sim'
import { ACTING_MS, PackMachine } from './packml-sim'
import type { AlarmEvent } from './alarms'
import { may } from './roles'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('stand-in runtime: alarms (step 33)', () => {
  it('U-33.5 raise → evt raise; ack once (twice is refused); clear removes it; every change is sent', () => {
    const sent: AlarmEvent[] = []
    const book = new AlarmBook(
      (e) => sent.push(e),
      [],
      () => new Date(2026, 10, 25, 13, 5, 9)
    )
    book.raise('E1202')
    expect(book.list).toEqual([
      {
        code: 'E1202',
        text: 'Plasma ready signal lost during cleaning (station 2)',
        priority: 1,
        time: '13:05:09',
        acked: false,
        active: true
      }
    ])
    expect(book.ack('E1202', 'A. Engineer')).toEqual({ ok: true })
    expect(book.ack('E1202', 'A. Engineer')).toEqual({ ok: false, err: 'ALARM', msg: 'E1202 is already acknowledged' })
    expect(book.ack('X9999', 'A. Engineer')).toEqual({ ok: false, err: 'ALARM', msg: 'no alarm X9999 in the list' })
    book.clear('E1202')
    expect(book.list).toEqual([])
    expect(sent.map((e) => (e.ev === 'alarm' ? `${e.act} ${e.code}` : e.ev))).toEqual(['raise E1202', 'ack E1202', 'clear E1202'])
    expect(book.snapshot()).toEqual({ ev: 'alarms', list: [] })
  })

  it('U-33.6 a P1 alarm aborts: EXECUTE → ABORTING → ABORTED; Reset clears → STOPPED; Ack is for Operator and up', () => {
    const m = new PackMachine(() => {})
    m.command('reset')
    vi.advanceTimersByTime(ACTING_MS)
    m.command('start')
    vi.advanceTimersByTime(ACTING_MS)
    m.abort()
    expect(m.status.state).toBe('ABORTING')
    vi.advanceTimersByTime(ACTING_MS)
    expect(m.status.state).toBe('ABORTED')
    m.abort() // nothing more to abort
    expect(m.status.state).toBe('ABORTED')
    m.command('reset')
    vi.advanceTimersByTime(ACTING_MS)
    expect(m.status.state).toBe('STOPPED')
    expect([may('Viewer', 'ack'), may('Operator', 'ack')]).toEqual([false, true])
  })
})
