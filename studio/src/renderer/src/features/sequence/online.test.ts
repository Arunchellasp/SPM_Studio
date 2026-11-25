import { describe, expect, it } from 'vitest'
import type { RtFile } from '@shared/generated/rt'
import type { Tag } from '@shared/ipc'
import type { FlowNode } from './flow'
import { activeNode, onlineView, type OnlineInput } from './online'

const RT: RtFile = {
  schema: 'spm.rt/1',
  crc: '34498683',
  tags_crc: 'D45C7CCE',
  flows: [
    {
      name: 'S1_Main',
      id: 0,
      station: 'S1',
      autostart: false,
      steps: [
        { i: 0, src: 'start', op: 'START', next: 1 },
        { i: 1, src: 'n1', op: 'WAIT_DI', tag: 0, val: 1, tmo: 0, next: 2 },
        { i: 2, src: 'n2', op: 'IF', rpn: ['T:1', 'K:100', 'GE'], yes: 3, no: 4 },
        { i: 3, src: 'end', op: 'END' },
        { i: 4, src: 'n3', op: 'SET_DO', tag: 2, val: 1, next: 1 }
      ]
    }
  ]
}
const TAGS = [{ name: 'DI_S1_PartPresent' }, { name: 'R_PartCount' }, { name: 'DO_S1_ClampValve' }] as Tag[]
const node = (id: string, type: string, p: Record<string, unknown> = {}): FlowNode =>
  ({ id, type, position: { x: 0, y: 0 }, data: { p, name: '', label: id } }) as unknown as FlowNode
const NODES = [
  node('start', 'start'),
  node('n1', 'wait_di', { tag: 'DI_S1_PartPresent' }),
  node('n2', 'if', { expr: 'R_PartCount >= 100' }),
  node('n3', 'set_do', { tag: 'DO_S1_ClampValve' }),
  node('end', 'end')
]
const at = (over: Partial<OnlineInput>): OnlineInput => ({
  link: 'online',
  prog: '34498683',
  rt: RT,
  flowName: 'S1_Main',
  pc: { '0': 1 },
  values: { '0': true, '1': 42 },
  tags: TAGS,
  nodes: NODES,
  links: 5,
  dirty: false,
  ...over
})

describe('online view of N02 (step 34)', () => {
  it('U-34.4 step event → node id: pc of the flow → the node it came from', () => {
    expect(activeNode(RT, 'S1_Main', { '0': 1 })).toBe('n1')
    expect(activeNode(RT, 'S1_Main', { '0': 4 })).toBe('n3')
    expect(activeNode(RT, 'S2_Main', { '0': 1 })).toBeNull() // not in the program
    expect(activeNode(RT, 'S1_Main', {})).toBeNull() // no pc yet
  })

  it('U-34.5 glow and values only when the runtime runs this very program; the text says why not', () => {
    expect(onlineView(at({}))).toEqual({
      kind: 'match',
      text: 'Online · n1',
      title: 'Online · the runtime runs this program (CRC 34498683) · S1_Main · step 1 (n1) · 5 nodes · 5 links',
      active: 'n1',
      live: { n1: 'DI_S1_PartPresent = TRUE', n2: 'R_PartCount = 42', n3: 'DO_S1_ClampValve = –' }
    })
    expect(onlineView(at({ dirty: true })).text).toBe('Online · n1 · changed')
    expect(onlineView(at({ prog: 'DEADBEEF' }))).toMatchObject({
      kind: 'other',
      active: null,
      text: 'Online · other program',
      title: 'Online · the runtime runs another program (CRC DEADBEEF) — Download this one · 5 nodes · 5 links'
    })
    expect(onlineView(at({ prog: null })).text).toBe('Online · no program')
    expect(onlineView(at({ rt: null })).kind).toBe('unbuilt')
    expect(onlineView(at({ link: 'offline' }))).toEqual({
      kind: 'offline',
      text: 'Offline · 5 nodes · 5 links',
      title: 'Runtime offline · 5 nodes · 5 links',
      active: null,
      live: {}
    })
  })
})
