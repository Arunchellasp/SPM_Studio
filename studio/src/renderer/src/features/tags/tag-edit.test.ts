import { describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { Tag, TagFile } from '@shared/ipc'
import { applyAddress, applyEdit, canEdit, parseValue } from './tag-edit'

const tags = (demo as TagFile).tags
const get = (list: Tag[], n: string): Tag => list.find((t) => t.name === n)!
const ok = (r: ReturnType<typeof applyEdit>): Tag[] => {
  if (!r.ok) throw new Error(r.error)
  return r.tags
}
const err = (r: ReturnType<typeof applyEdit>): string => (r.ok ? 'accepted' : r.error)

describe('N03 cell editing', () => {
  it('U-19.1 a good edit gives a new table with the changed tag; the old table is untouched', () => {
    const next = ok(applyEdit(tags, 'R_S1_Step', 'comment', 'Step number of station 1'))
    expect(get(next, 'R_S1_Step').desc).toBe('Step number of station 1')
    expect(get(tags, 'R_S1_Step').desc).toBe('Station 1 flow step')
    expect(next).not.toBe(tags)
    expect(get(next, 'DI_S1_PartPresent')).toBe(get(tags, 'DI_S1_PartPresent')) // others shared, not copied
  })

  it('U-19.2 wrong type refused: Init is parsed by the dtype', () => {
    expect(get(ok(applyEdit(tags, 'R_PartCount', 'init', '42')), 'R_PartCount').init).toBe(42)
    expect(err(applyEdit(tags, 'R_PartCount', 'init', 'abc'))).toBe("'abc' is not a whole number (DINT)")
    expect(err(applyEdit(tags, 'R_S1_Step', 'init', '40000'))).toBe('40000 is outside INT (-32768 … 32767)')
    expect(err(applyEdit(tags, 'T_S1_ClampDwell', 'init', '-5'))).toBe("'-5' — preset_ms is a whole number ≥ 0")
    expect(get(ok(applyEdit(tags, 'T_S1_ClampDwell', 'init', '450')), 'T_S1_ClampDwell').preset_ms).toBe(450)
    expect(parseValue('true', 'BOOL')).toEqual({ ok: true, value: true })
    expect(parseValue('2,5', 'REAL')).toEqual({ ok: true, value: 2.5 })
    expect(parseValue('yes', 'BOOL')).toEqual({ ok: false, error: "'yes' is not a BOOL — use TRUE or FALSE" })
  })

  it('U-19.3 names: pattern, prefix of the kind (from the schema), unique', () => {
    expect(get(ok(applyEdit(tags, 'DO_S1_Vacuum', 'name', 'DO_S1_VacuumOn')), 'DO_S1_VacuumOn').kind).toBe('DO')
    expect(err(applyEdit(tags, 'DO_S1_Vacuum', 'name', 'DI_S1_Vacuum'))).toBe('a DO name must start with DO_')
    expect(err(applyEdit(tags, 'DO_S1_Vacuum', 'name', 'do vacuum'))).toBe("'do vacuum' — use A–Z a–z 0–9 _ like DI_S1_PartPresent")
    expect(err(applyEdit(tags, 'DO_S1_Vacuum', 'name', 'DO_S1_ClampValve'))).toBe("'DO_S1_ClampValve' is already used by another tag")
  })

  it('U-19.4 Type only where the schema lets it change; a value that no longer fits is cleared with a note', () => {
    expect(canEdit({ kind: 'DI' }, 'type')).toBe(false)
    expect(canEdit({ kind: 'REG' }, 'type')).toBe(true)
    const r = applyEdit(tags, 'R_S1_Step', 'type', 'REAL')
    expect(r.ok && get(r.tags, 'R_S1_Step')).toMatchObject({ dtype: 'REAL', init: 0 })
    const zero = applyEdit(tags, 'R_S1_Step', 'type', 'BOOL') // init 0 fits BOOL as FALSE
    expect(zero.ok && get(zero.tags, 'R_S1_Step').init).toBe(false)
    const five = ok(applyEdit(tags, 'R_S1_Step', 'init', '5'))
    const s = applyEdit(five, 'R_S1_Step', 'type', 'BOOL')
    expect(s.ok && s.note).toBe('Init 5 did not fit BOOL and was cleared')
    expect(s.ok && 'init' in get(s.tags, 'R_S1_Step')).toBe(false)
    expect(err(applyEdit(tags, 'RP_SealTime', 'type', 'BOOL'))).toBe('the default 1200 is not a BOOL — change the default first')
    expect(err(applyEdit(tags, 'DI_S1_ClampOpen', 'type', 'INT'))).toBe('type cannot be changed for a DI tag')
  })

  it('U-19.5 scope, unit, retain, comment rules', () => {
    expect(get(ok(applyEdit(tags, 'R_S1_Step', 'scope', 'S3')), 'R_S1_Step').scope).toBe('S3')
    expect(err(applyEdit(tags, 'R_S1_Step', 'scope', 'Station 3'))).toBe("scope 'Station 3' — use global, S1 … S99, flow:<name> or fn:<name>")
    expect(err(applyEdit(tags, 'AI_Sealer_Temp', 'unit', ''))).toBe('a AI tag needs a unit')
    expect(canEdit({ kind: 'DI' }, 'unit')).toBe(false)
    expect(get(ok(applyEdit(tags, 'R_S1_Step', 'retain', true)), 'R_S1_Step').retain).toBe(true)
    expect('retain' in get(ok(applyEdit(tags, 'R_PartCount', 'retain', false)), 'R_PartCount')).toBe(false)
    expect(canEdit({ kind: 'DI' }, 'retain')).toBe(false)
    expect(get(ok(applyEdit(tags, 'A_301_NoPart', 'comment', 'No part after pick')), 'A_301_NoPart').text).toBe('No part after pick')
    expect(err(applyEdit(tags, 'A_301_NoPart', 'comment', ''))).toBe('an alarm needs its text')
    expect('desc' in get(ok(applyEdit(tags, 'R_S1_Step', 'comment', '')), 'R_S1_Step')).toBe(false)
  })

  it('U-19.6 address picker: I/O needs a channel, an axis has none, memory tags have no address', () => {
    const r = applyAddress(tags, 'DI_S1_PartPresent', { bus: 'sim', slave: 7, ch: 12 })
    expect(r.ok && get(r.tags, 'DI_S1_PartPresent').addr).toEqual({ bus: 'sim', slave: 7, ch: 12 })
    const ax = applyAddress(tags, 'AX_S1_X', { bus: 'ecat', slave: 9, ch: 3 })
    expect(ax.ok && get(ax.tags, 'AX_S1_X').addr).toEqual({ bus: 'ecat', slave: 9 })
    expect(err(applyAddress(tags, 'DI_S1_PartPresent', { bus: 'ecat', slave: 3, ch: NaN }))).toBe('channel is a whole number 0 … 255')
    expect(err(applyAddress(tags, 'DI_S1_PartPresent', { bus: 'ecat', slave: 600, ch: 0 }))).toBe('slave is a whole number 0 … 511')
    expect(err(applyAddress(tags, 'R_PartCount', { bus: 'ecat', slave: 1, ch: 0 }))).toBe('a REG tag lives in memory and has no address')
  })
})
