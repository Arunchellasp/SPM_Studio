import { describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { Tag, TagFile } from '@shared/ipc'
import { checkTags } from '@shared/tags-rules'
import { copyStation, freeSlaveOffset, generate, generatedNames, renamed } from './tag-bulk'

const tags = (demo as TagFile).tags
const ok = (r: ReturnType<typeof generate>): Tag[] => {
  if (!r.ok) throw new Error(r.error)
  return r.tags
}
const err = (r: ReturnType<typeof generate>): string => (r.ok ? 'accepted' : r.error)
const get = (list: Tag[], n: string): Tag => list.find((t) => t.name === n)!

describe('N03 bulk tools', () => {
  it('U-22.8 generate DI_S1_000 … 031 for a 32-channel card: clean, one change', () => {
    const r = generate(tags, { kind: 'DI', station: 'S3', count: 32, bus: 'ecat', slave: 20, firstCh: 0 })
    const t = ok(r)
    expect(t).toHaveLength(52)
    expect(t.slice(20).map((x) => x.name)).toEqual(generatedNames({ kind: 'DI', station: 'S3', count: 32, firstCh: 0 }))
    expect(t[20]).toEqual({ name: 'DI_S3_000', kind: 'DI', dtype: 'BOOL', scope: 'S3', addr: { bus: 'ecat', slave: 20, ch: 0 } })
    expect(t[51]!.name).toBe('DI_S3_031')
    expect(r.ok && r.note).toBe('Added 32 tags: DI_S3_000 … DI_S3_031')
    expect(checkTags(t)).toEqual([])
    const ai = ok(generate(tags, { kind: 'AI', station: '', count: 4, bus: 'sim', slave: 1, firstCh: 4 }))
    expect(get(ai, 'AI_004')).toMatchObject({ scope: 'global', unit: '%', scale: { raw: [0, 32767], eng: [0, 100] }, addr: { ch: 4 } })
  })

  it('U-22.9 generate refuses bad input and existing names; a clash with used channels shows red (rules)', () => {
    expect(err(generate(tags, { kind: 'DI', station: 'S1', count: 0, bus: 'ecat', slave: 3, firstCh: 0 }))).toBe('count is 1 … 256')
    expect(err(generate(tags, { kind: 'DI', station: 'S1', count: 10, bus: 'ecat', slave: 3, firstCh: 250 }))).toBe('channels must stay within 0 … 255')
    const twice = ok(generate(tags, { kind: 'DO', station: 'S5', count: 2, bus: 'ecat', slave: 9, firstCh: 0 }))
    expect(err(generate(twice, { kind: 'DO', station: 'S5', count: 4, bus: 'ecat', slave: 9, firstCh: 0 }))).toBe('2 of the names already exist (first: DO_S5_000)')
    const clash = ok(generate(tags, { kind: 'DI', station: 'S9', count: 2, bus: 'ecat', slave: 3, firstCh: 0 })) // ecat 3:0 is DI_S1_PartPresent
    expect(checkTags(clash).filter((i) => i.rule === 'address-twice').length).toBeGreaterThan(0)
  })

  it('U-22.10 copy station S1 → S2: renamed, moved to free cards, references follow, alarms get free codes, clean', () => {
    const off = freeSlaveOffset(tags, 'S1')
    expect(off).toBe(6) // S1 starts at slave 1, the project's highest slave is 6 (AO) → 6 + 1 − 1
    const r = copyStation(tags, { from: 'S1', to: 'S7', slaveOffset: off })
    const t = ok(r)
    const s1 = tags.filter((x) => x.scope === 'S1').length
    expect(t).toHaveLength(20 + s1)
    expect(get(t, 'DI_S7_PartPresent')).toMatchObject({ scope: 'S7', addr: { bus: 'ecat', slave: 9, ch: 0 }, group: 'S7 Pick and place/Inputs' })
    expect(get(t, 'P_S7_Pick').axes).toEqual(['AX_S7_X', 'AX_S7_Z'])
    expect(get(t, 'CY_S7_Clamp').fields).toEqual({ out: 'DO_S7_ClampValve', open: 'DI_S7_ClampOpen', closed: 'DI_S7_ClampClosed' })
    expect(get(t, 'A_301_NoPart_S7')).toMatchObject({ code: 900, scope: 'S7' })
    expect(checkTags(t)).toEqual([])
    expect(r.ok && r.note).toBe(`Copied ${s1} tags S1 → S7`)
  })

  it('U-22.11 copy refuses: same station, unknown station, names already there; offset 0 → clashes shown red', () => {
    expect(err(copyStation(tags, { from: 'S1', to: 'S1', slaveOffset: 0 }))).toBe('from and to are the same station')
    expect(err(copyStation(tags, { from: 'S8', to: 'S9', slaveOffset: 0 }))).toBe('no tags with scope S8')
    expect(err(copyStation(tags, { from: 'S1', to: 'Station 2', slaveOffset: 0 }))).toBe("target 'Station 2' — use a station S1 … S99")
    const once = ok(copyStation(tags, { from: 'S1', to: 'S3', slaveOffset: 10 }))
    expect(err(copyStation(once, { from: 'S1', to: 'S3', slaveOffset: 20 }))).toMatch(/^\d+ names already exist in S3 \(first: /)
    const same = ok(copyStation(tags, { from: 'S2', to: 'S4', slaveOffset: 0 }))
    expect(checkTags(same).some((i) => i.rule === 'address-twice')).toBe(true)
    expect(renamed('R_PartCount', 'S1', 'S2')).toBe('R_PartCount_S2')
  })
})
