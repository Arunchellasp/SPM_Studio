// Step 17 — generated types: up to date with the schemas, and really used by the code.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Addr, Tag, TagFile, TagKind } from '../src/shared/ipc'
import { generate, outPath, TARGETS } from './gen-types.mjs'

const tagsTarget = TARGETS.find((t) => t.out.endsWith('generated/tags.ts'))!

describe('generated types', () => {
  it.each(TARGETS)('U-17.1 $out is up to date with $schema (else: npm run gen)', async (t) => {
    const fresh = await generate(t)
    const committed = readFileSync(outPath(t), 'utf8')
    expect(committed, `${t.out} is out of date — run: npm run gen`).toBe(fresh)
  }, 20_000)

  it('U-17.2 every tag column of the schema is a field of the Tag type', () => {
    const schema = JSON.parse(readFileSync(resolve(__dirname, '../../schemas/tags.schema.json'), 'utf8'))
    const columns = Object.keys(schema.$defs.tag.properties)
    const text = readFileSync(outPath(tagsTarget), 'utf8')
    const tagBlock = text.slice(text.indexOf('export type Tag = {'), text.indexOf('\n}\n'))
    const fields = [...tagBlock.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])
    expect(fields).toEqual(columns)
    expect(columns).toHaveLength(40)
  })

  it('U-17.3 changing the schema changes the type (a new column, a new kind)', async () => {
    const changed = await generate(tagsTarget, (s) => {
      const tag = (s.$defs as Record<string, { properties: Record<string, unknown> }>).tag!
      tag.properties.cal_date = { type: 'string', description: 'last calibration' }
      ;(tag.properties.kind as { enum: string[] }).enum.push('ENCODER')
    })
    expect(changed).toContain('  cal_date?: string')
    expect(changed).toContain("| 'UDT' | 'ENCODER'")
    expect(changed).not.toBe(readFileSync(outPath(tagsTarget), 'utf8')) // → U-17.1 would fail until npm run gen
  }, 20_000)

  it('U-17.4 the compiler now knows the schema (checked by tsc in npm run check)', () => {
    expectTypeOf<TagKind>().toEqualTypeOf<'DI' | 'DO' | 'AI' | 'AO' | 'AXIS' | 'POINT' | 'REG' | 'TIMER' | 'COUNTER' | 'ALARM' | 'RECIPE' | 'UDT'>()
    expectTypeOf<TagFile['schema']>().toEqualTypeOf<'spm.tags/1'>()
    expectTypeOf<Addr['bus']>().toEqualTypeOf<'ecat' | 'sim'>()
    const ok: Tag = { name: 'DI_S1_Test', kind: 'DI', addr: { bus: 'ecat', slave: 3, ch: 4 } }
    // @ts-expect-error — 'DX' is not a kind
    const badKind: Tag = { name: 'DI_S1_Test', kind: 'DX' }
    // @ts-expect-error — no column 'preset_ms_' (typo), additionalProperties: false
    const typo: Tag = { name: 'T_S1_Test', kind: 'TIMER', preset_ms_: 300 }
    expect([ok, badKind, typo]).toHaveLength(3)
  })
})
