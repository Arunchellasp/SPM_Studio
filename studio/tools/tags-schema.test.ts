// Step 15 — the tag schema (schemas/tags.schema.json) and the demo tag table.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeTagChecker } from '../src/shared/tags-schema'

const root = resolve(__dirname, '../..')
const read = (p: string): unknown => JSON.parse(readFileSync(resolve(root, p), 'utf8'))
const schema = read('schemas/tags.schema.json') as object
const demo = read('projects/demo/tags.json') as { schema: string; tags: Record<string, unknown>[] }
const check = makeTagChecker(schema)

/** demo file with one tag replaced / changed */
function broken(change: (tags: Record<string, unknown>[]) => void): unknown {
  const copy = structuredClone(demo)
  change(copy.tags)
  return copy
}
const idx = (name: string): number => demo.tags.findIndex((t) => t.name === name)
const at = (name: string) => (tags: Record<string, unknown>[]) => tags.find((t) => t.name === name)!

describe('tags.schema.json', () => {
  it('U-15.1 the demo project (20 tags) is valid', () => {
    expect(check(demo)).toEqual({ ok: true, errors: [] })
    expect(demo.tags).toHaveLength(20)
  })

  it('U-15.2 the demo covers every tag kind', () => {
    const kinds = new Set(demo.tags.map((t) => t.kind))
    expect([...kinds].sort()).toEqual(
      ['AI', 'ALARM', 'AO', 'AXIS', 'COUNTER', 'DI', 'DO', 'POINT', 'RECIPE', 'REG', 'TIMER', 'UDT'].sort(),
    )
  })

  it('U-15.3 the demo is saved sorted by name (clean Git diffs)', () => {
    const names = demo.tags.map((t) => t.name as string)
    expect(names).toEqual([...names].sort())
  })

  it('U-15.4 wrong file version is rejected', () => {
    const r = check({ ...demo, schema: 'spm.tags/2' })
    expect(r.ok).toBe(false)
    expect(r.errors).toContain(`schema: must be "spm.tags/1"`)
  })

  it('U-15.5 unknown kind is rejected and the tag is named', () => {
    const r = check(broken((tags) => { at('DI_S1_PartPresent')(tags).kind = 'DX' }))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.startsWith(`tag `) && e.includes(`'DI_S1_PartPresent' › kind: must be one of "DI"`))).toBe(true)
  })

  it('U-15.6 an input without a channel is rejected', () => {
    const r = check(broken((tags) => { delete (at('DI_S1_ClampOpen')(tags).addr as Record<string, unknown>).ch }))
    expect(r.errors).toEqual([`tag ${idx('DI_S1_ClampOpen')} 'DI_S1_ClampOpen' › addr: must have property 'ch'`])
  })

  it('U-15.7 a name that breaks the naming rule is rejected (prefix must match kind)', () => {
    const r1 = check(broken((tags) => { at('DO_S1_Vacuum')(tags).name = 'do s1 vacuum' }))
    expect(r1.errors[0]).toMatch(/› name: does not match the naming rule/)
    const r2 = check(broken((tags) => { at('DO_S1_Vacuum')(tags).name = 'DI_S1_Vacuum' }))
    expect(r2.errors).toEqual([`tag ${idx('DO_S1_Vacuum')} 'DI_S1_Vacuum' › name: does not match the naming rule ^DO_`])
  })

  it('U-15.8 a typo in a column name is rejected (no silent extra fields)', () => {
    const r = check(broken((tags) => { at('T_S1_ClampDwell')(tags).preset_ms_ = 300 }))
    expect(r.errors).toContain(`tag ${idx('T_S1_ClampDwell')} 'T_S1_ClampDwell': unknown property 'preset_ms_'`)
  })

  it('U-15.9 a memory tag with an address, or a wrong dtype for an I/O kind, is rejected', () => {
    const r = check(broken((tags) => {
      at('R_PartCount')(tags).addr = { bus: 'ecat', slave: 3, ch: 5 }
      at('AI_Sealer_Temp')(tags).dtype = 'BOOL'
    }))
    expect(r.errors).toEqual(expect.arrayContaining([
      `tag ${idx('AI_Sealer_Temp')} 'AI_Sealer_Temp' › dtype: must be "REAL"`,
      `tag ${idx('R_PartCount')} 'R_PartCount': must not have this property set (memory tags have no address)`,
    ]))
  })
})
