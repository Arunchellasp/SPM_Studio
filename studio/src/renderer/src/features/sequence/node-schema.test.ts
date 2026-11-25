// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { Tag, TagFile } from '@shared/ipc'
import { useSequence } from '../../stores/sequence.store'
import { defaultParams, summary, type StepParams } from './flow'
import { afterChange, FIELDS, parseField, tagsFor } from './node-schema'

// the demo + one BOOL register + a point that only uses axis X
const tags: Tag[] = [
  ...(demo as TagFile).tags,
  { name: 'R_S1_Ready', kind: 'REG', dtype: 'BOOL', scope: 'S1', init: false },
  { name: 'P_S1_Home', kind: 'POINT', dtype: 'REAL', axes: ['AX_S1_X'], values: [0] }
]
const field = (type: keyof typeof FIELDS, key: string) => FIELDS[type].find((f) => f.key === key)!
const names = (list: Tag[]): string[] => list.map((t) => t.name)

beforeEach(() => useSequence.getState().reset())

describe('N02 property panel (step 25)', () => {
  it('U-25.1 TagPicker filters by kind: Wait input offers only DI inputs (and BOOL registers), Set output only DO', () => {
    const w = tagsFor('wait_di', field('wait_di', 'tag'), tags, defaultParams('wait_di'))
    expect(names(w)).toEqual(['DI_S1_ClampClosed', 'DI_S1_ClampOpen', 'DI_S1_PartPresent', 'DI_S2_DoorClosed', 'R_S1_Ready'])
    expect(w.every((t) => t.kind === 'DI' || (t.kind === 'REG' && t.dtype === 'BOOL'))).toBe(true)
    expect(names(tagsFor('set_do', field('set_do', 'tag'), tags, defaultParams('set_do')))).toEqual([
      'DO_S1_ClampValve',
      'DO_S1_Vacuum',
      'DO_S2_HeaterOn'
    ])
    expect(names(tagsFor('wait_di', field('wait_di', 'alarm'), tags, defaultParams('wait_di')))).toEqual(['A_301_NoPart'])
  })

  it('U-25.2 Move: axes only; points only of the chosen axis; a new axis clears a point that does not fit', () => {
    const p = defaultParams('move_abs')
    expect(names(tagsFor('move_abs', field('move_abs', 'axis'), tags, p))).toEqual(['AX_S1_X', 'AX_S1_Z'])
    expect(names(tagsFor('move_abs', field('move_abs', 'point'), tags, p))).toEqual(['P_S1_Home', 'P_S1_Pick', 'P_S1_Place'])
    const onZ: StepParams['move_abs'] = { axis: 'AX_S1_Z', point: '', speed: 100 }
    expect(names(tagsFor('move_abs', field('move_abs', 'point'), tags, onZ))).toEqual(['P_S1_Pick', 'P_S1_Place'])
    expect(afterChange('move_abs', 'axis', { axis: 'AX_S1_Z', point: 'P_S1_Home', speed: 80 }, tags)).toEqual({
      axis: 'AX_S1_Z',
      point: '',
      speed: 80
    })
    expect(afterChange('move_abs', 'axis', { axis: 'AX_S1_X', point: 'P_S1_Home', speed: 80 }, tags)).toMatchObject({ point: 'P_S1_Home' })
  })

  it('U-25.3 wrong kind / unknown tag / empty refused with the reason; optional alarm may stay empty', () => {
    const p = defaultParams('wait_di')
    expect(parseField('wait_di', field('wait_di', 'tag'), 'DO_S1_Vacuum', tags, p)).toEqual({
      ok: false,
      error: 'DO_S1_Vacuum is not one of the digital inputs (DI) and BOOL registers'
    })
    expect(parseField('wait_di', field('wait_di', 'tag'), 'DI_Nope', tags, p)).toEqual({
      ok: false,
      error: 'no tag DI_Nope in the project'
    })
    expect(parseField('wait_di', field('wait_di', 'tag'), '', tags, p)).toEqual({
      ok: false,
      error: 'choose one of the digital inputs (DI) and BOOL registers'
    })
    expect(parseField('wait_di', field('wait_di', 'tag'), ' DI_S1_PartPresent ', tags, p)).toEqual({ ok: true, value: 'DI_S1_PartPresent' })
    expect(parseField('wait_di', field('wait_di', 'alarm'), '', tags, p)).toEqual({ ok: true, value: '' })
  })

  it('U-25.4 numbers: whole, with limits and unit in the message; TRUE / FALSE', () => {
    const p = defaultParams('move_abs')
    expect(parseField('move_abs', field('move_abs', 'speed'), '80', tags, p)).toEqual({ ok: true, value: 80 })
    expect(parseField('move_abs', field('move_abs', 'speed'), '120', tags, p)).toEqual({ ok: false, error: '1 … 100 %' })
    expect(parseField('move_abs', field('move_abs', 'speed'), 'fast', tags, p)).toEqual({ ok: false, error: 'a whole number in %' })
    expect(parseField('delay', field('delay', 'ms'), '0', tags, defaultParams('delay'))).toEqual({ ok: false, error: '1 … 3600000 ms' })
    expect(parseField('wait_di', field('wait_di', 'value'), 'FALSE', tags, defaultParams('wait_di'))).toEqual({ ok: true, value: false })
  })

  it('U-25.5 the store updates one node; the summary follows (no more ?)', () => {
    const id = useSequence.getState().addStep('wait_di')
    useSequence
      .getState()
      .updateNode(id, { p: { tag: 'DI_S1_PartPresent', value: true, timeout_ms: 3000, alarm: 'A_301_NoPart' }, name: 'Part there' })
    const n = useSequence.getState().nodes.find((x) => x.id === id)!
    expect(n.data).toMatchObject({ name: 'Part there', label: 'Wait input' })
    expect(summary('wait_di', n.data.p)).toBe('WAIT DI_S1_PartPresent = TRUE · 3 s')
  })
})
