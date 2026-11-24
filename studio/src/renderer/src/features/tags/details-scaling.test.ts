/** Found on the PC (physical test P-20.4): after REG → AI the details had no Scaling row, so 'needs scale' could not be fixed. */
import { describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { Tag, TagFile } from '@shared/ipc'
import { checkTags } from '@shared/tags-rules'
import { toGridRow } from './tag-grid'
import { detailRows } from './tags'

const tags = (demo as TagFile).tags
const scaling = (t: Tag): string | undefined => detailRows(t, toGridRow(t)).find((r) => r.label === 'Scaling')?.value

describe('U-F2 Scaling row in the tag details', () => {
  it('U-F2.1 an AI without a scaling yet still shows the row (so its Change… is there)', () => {
    const step = tags.find((t) => t.name === 'R_S1_Step') as Tag
    const asAI = { ...step, kind: 'AI', dtype: 'REAL', init: undefined } as Tag
    expect(scaling(asAI)).toBe('– (none yet)')
  })
  it('U-F2.2 an AI with a scaling shows its ranges', () => {
    expect(scaling(tags.find((t) => t.name === 'AI_Sealer_Temp') as Tag)).toMatch(/^raw .* → .* degC$/)
  })
  it('U-F2.3 kinds that cannot have a scaling do not show the row', () => {
    for (const n of ['DI_S1_PartPresent', 'R_S1_Step', 'T_S1_ClampDwell']) expect(scaling(tags.find((t) => t.name === n) as Tag)).toBeUndefined()
  })
  it("U-F2.4 messages say 'an AI', 'an AXIS' but 'a DI'", () => {
    const bad = [
      { name: 'X1', kind: 'AI', dtype: 'REAL', scope: 'S1' },
      { name: 'X2', kind: 'DI', dtype: 'BOOL', scope: 'S1' }
    ] as Tag[]
    const m = checkTags(bad).map((i) => i.message)
    expect(m).toContain('an AI name must start with AI_')
    expect(m).toContain('a DI name must start with DI_')
  })
})
