import { describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { Tag, TagFile } from '@shared/ipc'
import { addressText, countText, groupOf, KIND_GROUPS, matches, NO_FILTER, optionsOf, toGridRow } from './tag-grid'
import { detailRows } from './tags'

const tags = (demo as TagFile).tags
const rows = tags.map((t) => toGridRow(t))
const byName = (n: string): Tag => tags.find((t) => t.name === n)!
const shown = (f: Partial<typeof NO_FILTER>): string[] => rows.filter((r) => matches(r, { ...NO_FILTER, ...f })).map((r) => r.name)

describe('N03 tag grid logic', () => {
  it('U-18.1 every demo tag becomes one row with the 10 design columns', () => {
    expect(rows).toHaveLength(20)
    expect(toGridRow(byName('DI_S1_PartPresent'))).toMatchObject({
      name: 'DI_S1_PartPresent', address: 'ecat 3:0', type: 'BOOL', scope: 'S1', unit: '', init: '', retain: '', mappedTo: '', live: '–', comment: 'Part on nest'
    })
    expect(toGridRow(byName('R_PartCount'))).toMatchObject({ address: '–', type: 'DINT', scope: 'global', init: '0', retain: '✓' })
    expect(toGridRow(byName('T_S1_ClampDwell'))).toMatchObject({ type: 'TIMER', unit: 'ms', init: '300' })
    expect(toGridRow(byName('AX_S1_X'))).toMatchObject({ address: 'ecat 1', type: 'AXIS', unit: 'mm' })
    expect(toGridRow(byName('RP_SealTime'))).toMatchObject({ init: '1200', scope: 'global' })
  })

  it('U-18.2 filter by kind group: every tag is in exactly one group', () => {
    expect(shown({ group: 'inputs' })).toEqual(['AI_Sealer_Temp', 'DI_S1_ClampClosed', 'DI_S1_ClampOpen', 'DI_S1_PartPresent', 'DI_S2_DoorClosed'])
    expect(shown({ group: 'outputs' })).toEqual(['AO_Dispense_Pressure', 'DO_S1_ClampValve', 'DO_S1_Vacuum', 'DO_S2_HeaterOn'])
    expect(shown({ group: 'flags' })).toEqual(['A_301_NoPart'])
    expect(shown({ group: 'timers' })).toEqual(['C_ShiftGood', 'T_S1_ClampDwell'])
    expect(shown({ group: 'points' })).toEqual(['AX_S1_X', 'AX_S1_Z', 'P_S1_Pick', 'P_S1_Place'])
    const groups = KIND_GROUPS.filter((g) => g.value !== 'all').map((g) => shown({ group: g.value }).length)
    expect(groups.reduce((a, b) => a + b, 0)).toBe(20)
    expect(groupOf({ kind: 'REG', dtype: 'BOOL' })).toBe('flags')
    expect(groupOf({ kind: 'REG', dtype: 'DINT' })).toBe('data')
  })

  it('U-18.3 search looks in name, comment and address (any case); scope and type filter exactly', () => {
    expect(shown({ text: 'clamp' })).toEqual(['CY_S1_Clamp', 'DI_S1_ClampClosed', 'DI_S1_ClampOpen', 'DO_S1_ClampValve', 'T_S1_ClampDwell'])
    expect(shown({ text: 'NEST' })).toEqual(['A_301_NoPart', 'CY_S1_Clamp', 'DI_S1_PartPresent']) // comment or alarm text
    expect(shown({ text: 'ecat 4:' })).toEqual(['DO_S1_ClampValve', 'DO_S1_Vacuum', 'DO_S2_HeaterOn'])
    expect(shown({ scope: 'S2', type: 'BOOL' })).toEqual(['DI_S2_DoorClosed', 'DO_S2_HeaterOn'])
    expect(shown({ text: 'clamp', group: 'outputs' })).toEqual(['DO_S1_ClampValve'])
    expect(shown({ text: 'nothing like this' })).toEqual([])
  })

  it('U-18.4 Scope / Type lists come from the data, global first', () => {
    expect(optionsOf(rows, 'scope')).toEqual(['global', 'S1', 'S2'])
    expect(optionsOf(rows, 'type')).toEqual(['ALARM', 'AXIS', 'BOOL', 'COUNTER', 'DINT', 'INT', 'POINT', 'REAL', 'TIMER', 'UDT'])
  })

  it('U-18.5 address text and count text', () => {
    expect(addressText({ name: 'X', kind: 'DI', addr: { bus: 'sim', slave: 0, ch: 7 } })).toBe('sim 0:7')
    expect(addressText({ name: 'X', kind: 'REG' })).toBe('–')
    expect(countText(20, 20)).toBe('20 tags')
    expect(countText(5, 20)).toBe('5 of 20 tags')
    expect(countText(1, 1)).toBe('1 tag')
  })

  it('U-18.6 Tag details panel rows (read only)', () => {
    const ai = byName('AI_Sealer_Temp')
    const d = Object.fromEntries(detailRows(ai, toGridRow(ai)).map((r) => [r.label, r.value]))
    expect(d).toMatchObject({ Kind: 'AI · Analog input', Address: 'ecat 5:1', Type: 'REAL', Scope: 'S2', Alarm: 'code 410 · hi 250 · hihi 280', Comment: 'Sealer jaw temperature' })
    const al = byName('A_301_NoPart')
    expect(detailRows(al, toGridRow(al)).find((r) => r.label === 'Alarm')?.value).toBe('code 301 · P2 · pause · latched')
  })
})
