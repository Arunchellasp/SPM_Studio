// Step 29 — the compiler refuses what cannot run, every problem with flow and node id; CRC-32 as zlib.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProgramFile, ProgramFlow, TagFile } from '@shared/ipc'
import { compile, crc32, describe as line, verifyRt } from '@shared/compile'

const tags = JSON.parse(readFileSync(resolve(__dirname, '../../../../projects/demo/tags.json'), 'utf8')) as TagFile
const prog = (...flows: ProgramFlow[]): ProgramFile => ({ schema: 'spm.program/1', flows })
const base = (nodes: ProgramFlow['nodes'], edges: ProgramFlow['edges']): ProgramFlow => ({
  name: 'S1_Main',
  station: 'S1',
  nodes: [{ id: 'start', type: 'start', pos: [0, 0] }, { id: 'end', type: 'end', pos: [0, 240] }, ...nodes],
  edges
})
const errors = (p: ProgramFile): string[] => {
  const r = compile(p, tags)
  return r.ok ? [] : r.errors.map(line)
}

describe('compiler (step 29)', () => {
  it('U-29.2 CRC-32 is the standard one (zlib): "123456789" → CBF43926', () => {
    expect(crc32('123456789')).toBe('CBF43926')
    expect(crc32('')).toBe('00000000')
  })

  it('U-29.3 the graph: Starts, links to missing nodes, open ways out, unreachable nodes, two flows with one name', () => {
    expect(errors(prog({ ...base([], []), nodes: [{ id: 'end', type: 'end', pos: [0, 0] }] }))).toEqual(['S1_Main: the flow has no Start'])
    expect(
      errors(
        prog(
          base(
            [{ id: 'n1', type: 'start', pos: [0, 0] }],
            [
              ['start', 'end'],
              ['n1', 'end']
            ]
          )
        )
      )
    ).toEqual(['S1_Main: 2 Starts — a flow has exactly one'])
    expect(
      errors(
        prog(
          base(
            [
              { id: 'n1', type: 'if', pos: [0, 96], p: { expr: 'R_PartCount > 1' } },
              { id: 'n2', type: 'delay', pos: [0, 96], p: { ms: 5 } }
            ],
            [
              ['start', 'n1'],
              ['n1', 'end', 'yes'],
              ['n1', 'nX'],
              ['start', 'n2', 'no']
            ]
          )
        )
      )
    ).toEqual([
      'S1_Main · n1: link n1 → nX leads to a node that is not there',
      "S1_Main · start: link start → n2 ('no') does not fit a start node",
      "S1_Main · n1: 'no' way out is not linked",
      'S1_Main · n2: way out is not linked',
      'S1_Main · n2: cannot be reached from Start'
    ])
    expect(errors(prog(base([], [['start', 'end']]), base([], [['start', 'end']])))).toEqual(['S1_Main: two flows have this name'])
  })

  it('U-29.4 parameters: open, unknown tag, wrong kind, a point of another axis, numbers out of range — with the node id', () => {
    const e = errors(
      prog(
        base(
          [
            { id: 'n1', type: 'wait_di', pos: [0, 0], p: { tag: 'DO_S1_Vacuum', value: true, timeout_ms: 5000, alarm: 'DI_S1_ClampOpen' } },
            { id: 'n2', type: 'set_do', pos: [0, 0], p: { tag: '', value: true } },
            { id: 'n3', type: 'move_abs', pos: [0, 0], p: { axis: 'AX_S9', point: 'P_S1_Pick', speed: 120 } },
            { id: 'n4', type: 'delay', pos: [0, 0], p: { ms: 0 } },
            { id: 'n5', type: 'if', pos: [0, 0], p: { expr: '  ' } }
          ],
          [
            ['start', 'n1'],
            ['n1', 'n2'],
            ['n2', 'n3'],
            ['n3', 'n4'],
            ['n4', 'n5'],
            ['n5', 'end', 'yes'],
            ['n5', 'end', 'no']
          ]
        )
      )
    )
    expect(e).toEqual([
      'S1_Main · n1: DO_S1_Vacuum is a DO, not a digital input (DI) or BOOL register',
      'S1_Main · n1: DI_S1_ClampOpen is a DI, not an alarm (ALARM)',
      'S1_Main · n2: tag is not set',
      'S1_Main · n3: no tag AX_S9 in tags.json',
      'S1_Main · n3: speed must be a whole number 1 … 100 (is 120)',
      'S1_Main · n4: ms must be a whole number 1 … 3600000 (is 0)',
      'S1_Main · n5: the condition is empty'
    ])
    // a point that does not list the axis
    const pt = { ...tags, tags: tags.tags.map((t) => (t.name === 'P_S1_Pick' ? { ...t, axes: ['AX_S1_Z'] as [string] } : t)) }
    const r = compile(
      prog(
        base(
          [{ id: 'n1', type: 'move_abs', pos: [0, 0], p: { axis: 'AX_S1_X', point: 'P_S1_Pick', speed: 50 } }],
          [
            ['start', 'n1'],
            ['n1', 'end']
          ]
        )
      ),
      pt
    )
    expect(r.ok ? [] : r.errors.map(line)).toEqual(['S1_Main · n1: point P_S1_Pick does not belong to axis AX_S1_X'])
  })

  it('U-29.5 the CRCs: the file CRC covers the flows (another step → another CRC); tags_crc changes with the tag table', () => {
    const a = compile(prog(base([], [['start', 'end']])), tags)
    const b = compile(
      prog(
        base(
          [{ id: 'n1', type: 'delay', pos: [0, 0], p: { ms: 5 } }],
          [
            ['start', 'n1'],
            ['n1', 'end']
          ]
        )
      ),
      tags
    )
    const c = compile(prog(base([], [['start', 'end']])), { ...tags, tags: tags.tags.slice(1) })
    if (!a.ok || !b.ok || !c.ok) throw new Error('expected to compile')
    expect(a.rt.crc).not.toBe(b.rt.crc)
    expect(a.rt.tags_crc).toBe(b.rt.tags_crc)
    expect(c.rt.tags_crc).not.toBe(a.rt.tags_crc)
    expect(a.text).toContain(`"crc": "${a.rt.crc}"`)
  })

  it('U-30.6 the compiler: a condition becomes RPN; a wrong type is an error with the node id', () => {
    const flow = (expr: string): ProgramFile =>
      prog(
        base(
          [{ id: 'n7', type: 'if', pos: [0, 0], p: { expr } }],
          [
            ['start', 'n7'],
            ['n7', 'end', 'yes'],
            ['n7', 'end', 'no']
          ]
        )
      )
    const ok = compile(flow('R_PartCount >= 100 or DI_S1_PartPresent'), tags)
    expect(ok.ok && ok.rt.flows[0]!.steps[1]).toMatchObject({ op: 'IF', rpn: ['T:17', 'K:100', 'GE', 'T:9', 'OR'] })
    expect(errors(flow('R_PartCount + 1'))).toEqual([
      'S1_Main · n7: condition: a condition must give TRUE / FALSE — R_PartCount + 1 gives a number'
    ])
    expect(errors(flow('AX_S1_X > 1'))).toEqual([
      'S1_Main · n7: condition: AX_S1_X is an AXIS — it has no single value to use here (DI, DO, AI, AO, REG, RECIPE have)'
    ])
    expect(errors(flow('R_PartCount >'))).toEqual(['S1_Main · n7: condition: Expected expression after > (position 14)'])
  })

  it('U-34.3 the runtime check of a download: schema and CRC (a changed step is refused)', () => {
    const r = compile(
      prog(
        base(
          [{ id: 'n7', type: 'delay', pos: [0, 0], p: { ms: 500 } }],
          [
            ['start', 'n7'],
            ['n7', 'end']
          ]
        )
      ),
      tags
    )
    if (!r.ok) throw new Error('should compile')
    expect(verifyRt(r.rt)).toEqual({ ok: true, crc: r.rt.crc })
    const changed = structuredClone(r.rt)
    ;(changed.flows[0]!.steps[1] as { ms: number }).ms = 50
    expect(verifyRt(changed)).toMatchObject({ ok: false, err: 'CRC' })
    expect(verifyRt({ ...r.rt, schema: 'spm.rt/2' })).toEqual({
      ok: false,
      err: 'SCHEMA',
      msg: 'schema must be "spm.rt/1", not "spm.rt/2"'
    })
  })
})
