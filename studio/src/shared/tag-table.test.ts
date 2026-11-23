import { describe, expect, it } from 'vitest'
import demo from '../../../projects/demo/tags.json'
import type { Tag, TagFile } from './ipc'
import { applyImport, fromRows, planImport, toRows } from './tag-table'

const tags = (demo as TagFile).tags

describe('tag table rows', () => {
  it('U-22.6 toRows → fromRows is the identity (every field kept, rest in "more")', () => {
    const rows = toRows(tags)
    expect(rows[0]).toMatchObject({ name: 'AI_Sealer_Temp', bus: 'ecat', slave: 5, ch: 1, unit: 'degC' })
    expect(fromRows(rows)).toEqual({ tags, errors: [] })
  })

  it('U-22.7 import plan and merge / replace', () => {
    const incoming: Tag[] = [
      { ...tags.find((t) => t.name === 'R_S1_Step')!, desc: 'from Excel' },
      tags.find((t) => t.name === 'R_PartCount')!,
      { name: 'R_New_Excel', kind: 'REG', dtype: 'INT', init: 0 }
    ]
    const plan = planImport(tags, incoming)
    expect(plan).toMatchObject({ added: ['R_New_Excel'], changed: ['R_S1_Step'], same: ['R_PartCount'] })
    expect(plan.missing).toHaveLength(18)
    const merged = applyImport(tags, incoming, 'merge')
    expect(merged).toHaveLength(21)
    expect(merged.find((t) => t.name === 'R_S1_Step')!.desc).toBe('from Excel')
    expect(applyImport(tags, incoming, 'replace')).toBe(incoming)
  })
})
