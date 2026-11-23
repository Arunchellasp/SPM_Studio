import { describe, expect, it } from 'vitest'
import type { TagFile } from './ipc'
import { countByKind, formatTagFile, sortTags } from './tags-file'

const file: TagFile = {
  schema: 'spm.tags/1',
  tags: [
    { name: 'R_B', kind: 'REG', dtype: 'INT' },
    { name: 'DI_A', kind: 'DI' },
    { name: 'DI_B', kind: 'DI' }
  ]
}

describe('tags-file', () => {
  it('U-16.7 sorts by name without changing the input', () => {
    expect(sortTags(file).tags.map((t) => t.name)).toEqual(['DI_A', 'DI_B', 'R_B'])
    expect(file.tags[0]!.name).toBe('R_B')
  })

  it('U-16.8 writes 2-space JSON with one newline at the end, LF or CRLF', () => {
    const lf = formatTagFile(file)
    expect(lf.startsWith('{\n  "schema": "spm.tags/1",\n  "tags": [\n    {\n      "name": "DI_A"')).toBe(true)
    expect(lf.endsWith('}\n')).toBe(true)
    expect(formatTagFile(file, '\r\n')).toBe(lf.replace(/\n/g, '\r\n'))
  })

  it('U-16.9 counts tags per kind in schema order, leaving out empty kinds', () => {
    expect(countByKind(file)).toEqual([
      { kind: 'DI', count: 2 },
      { kind: 'REG', count: 1 }
    ])
  })
})
