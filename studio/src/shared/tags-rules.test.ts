// Step 20 — tags.rules: every rule has a test (roadmap).
import { describe, expect, it } from 'vitest'
import demo from '../../../projects/demo/tags.json'
import type { Tag, TagFile } from './ipc'
import { makeBigProject } from './big-project'
import { checkTags, KIND_RULES, KIND_SPECIFIC } from './tags-rules'

const base = (demo as TagFile).tags
const edit = (fn: (tags: Tag[]) => void): Tag[] => {
  const t = structuredClone(base)
  fn(t)
  return t
}
const get = (tags: Tag[], n: string): Tag => tags.find((t) => t.name === n)!
const msgs = (tags: Tag[]): string[] => checkTags(tags).map((i) => `${i.tag} [${i.column}] ${i.message}`)

describe('tags.rules', () => {
  it('U-20.1 the demo and the 1000-tag project have no problems', () => {
    expect(checkTags(base)).toEqual([])
    expect(checkTags(makeBigProject().tags)).toEqual([])
  })

  it('U-20.2 per-kind rules are read from the schema (12 kinds)', () => {
    expect(Object.keys(KIND_RULES)).toHaveLength(12)
    expect(KIND_RULES.AI).toMatchObject({ required: ['addr', 'scale', 'unit'], dtype: ['REAL'], memory: false })
    expect(KIND_RULES.REG!.memory).toBe(true)
    expect(KIND_SPECIFIC).toEqual(expect.arrayContaining(['addr', 'scale', 'unit', 'ppu', 'axes', 'preset_ms', 'code', 'fields']))
  })

  it('U-20.3 duplicate name', () => {
    const t = edit((x) => x.push({ ...get(x, 'R_S1_Step') }))
    expect(msgs(t)).toContain('R_S1_Step [name] the name R_S1_Step is used 2 times')
  })

  it('U-20.4 address used twice — I/O channel, and a drive sharing a slave with I/O', () => {
    const t = edit((x) => (get(x, 'DI_S1_ClampOpen').addr = { bus: 'ecat', slave: 3, ch: 0 }))
    expect(msgs(t)).toEqual([
      'DI_S1_ClampOpen [address] address ecat 3:0 is also used by DI_S1_PartPresent',
      'DI_S1_PartPresent [address] address ecat 3:0 is also used by DI_S1_ClampOpen'
    ])
    const d = edit((x) => (get(x, 'AX_S1_Z').addr = { bus: 'ecat', slave: 3 }))
    expect(msgs(d)).toEqual(expect.arrayContaining([
      'AX_S1_Z [address] slave ecat 3 is also used by DI_S1_PartPresent',
      'DI_S1_PartPresent [address] slave ecat 3 is the drive of AX_S1_Z'
    ]))
    const sim = edit((x) => (get(x, 'DI_S1_ClampOpen').addr = { bus: 'sim', slave: 3, ch: 0 })) // other bus: fine
    expect(checkTags(sim)).toEqual([])
  })

  it('U-20.5 min ≥ max, and Init / default outside min … max', () => {
    expect(msgs(edit((x) => (get(x, 'R_S1_Step').min = 1000)))).toEqual(['R_S1_Step [init] min 1000 must be below max 999'])
    expect(msgs(edit((x) => (get(x, 'R_S1_Step').init = 1500)))).toEqual(['R_S1_Step [init] init 1500 is above max 999'])
    expect(msgs(edit((x) => (get(x, 'RP_SealTime').default = 100)))).toEqual(['RP_SealTime [init] default 100 is below min 500'])
  })

  it('U-20.6 soft limits, alarm limits, scaling', () => {
    expect(msgs(edit((x) => (get(x, 'AX_S1_X').soft_max = -5)))).toEqual(['AX_S1_X [unit] soft limit min 0 must be below max -5'])
    expect(msgs(edit((x) => (get(x, 'AI_Sealer_Temp').alarm = { hi: 300, hihi: 280, code: 410 })))).toEqual([
      'AI_Sealer_Temp [name] alarm limits must rise: hi 300 ≥ hihi 280'
    ])
    expect(msgs(edit((x) => (get(x, 'AI_Sealer_Temp').scale = { raw: [32767, 0], eng: [5, 5] })))).toEqual([
      'AI_Sealer_Temp [unit] raw range 32767 … 0 must rise',
      'AI_Sealer_Temp [unit] eng range 5 … 5 is empty'
    ])
  })

  it('U-20.7 broken references after a rename (POINT axes, UDT fields)', () => {
    const t = edit((x) => {
      get(x, 'AX_S1_X').name = 'AX_S1_Xx'
      get(x, 'DO_S1_ClampValve').name = 'DO_S1_Clamp'
    })
    expect(msgs(t)).toEqual([
      'CY_S1_Clamp [name] field out → DO_S1_ClampValve does not exist',
      'P_S1_Pick [name] axis AX_S1_X does not exist',
      'P_S1_Place [name] axis AX_S1_X does not exist'
    ])
    expect(msgs(edit((x) => (get(x, 'P_S1_Pick').axes = ['AX_S1_X', 'R_S1_Step' as string])))).toContain('P_S1_Pick [name] R_S1_Step is not an axis')
  })

  it('U-20.8 per kind: prefix, required column, fixed type, memory without address', () => {
    const t = edit((x) => {
      const r = get(x, 'R_S1_Step')
      ;(r as { kind: string }).kind = 'DO' // DO needs an address and BOOL, name must start with DO_
      ;(r as { dtype: string }).dtype = 'INT'
      const c = get(x, 'C_ShiftGood')
      c.addr = { bus: 'ecat', slave: 9, ch: 0 }
    })
    expect(msgs(t)).toEqual([
      'C_ShiftGood [address] a COUNTER tag lives in memory and must not have an address',
      'R_S1_Step [name] a DO name must start with DO_',
      'R_S1_Step [address] a DO tag needs an address',
      'R_S1_Step [type] type of a DO must be BOOL'
    ])
  })
})
