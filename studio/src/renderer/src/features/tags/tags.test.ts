import { describe, expect, it } from 'vitest'
import demo from '../../../../../../projects/demo/tags.json'
import type { TagFile } from '@shared/ipc'
import { KIND_LABEL, kindRows, tagCountText } from './tags'

describe('N03 words', () => {
  it('U-16.10 the demo project gives one row per kind, with a label for every kind', () => {
    const rows = kindRows({ name: 'demo', dir: '/x', tags: demo as TagFile })
    expect(rows.map((r) => `${r.kind} ${r.count}`)).toEqual([
      'DI 4', 'DO 3', 'AI 1', 'AO 1', 'AXIS 2', 'POINT 2', 'REG 2', 'TIMER 1', 'COUNTER 1', 'ALARM 1', 'RECIPE 1', 'UDT 1'
    ])
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(20)
    expect(Object.keys(KIND_LABEL)).toHaveLength(12)
  })

  it('U-16.11 tag count text', () => {
    expect(tagCountText(20)).toBe('20 tags')
    expect(tagCountText(1)).toBe('1 tag')
  })
})
