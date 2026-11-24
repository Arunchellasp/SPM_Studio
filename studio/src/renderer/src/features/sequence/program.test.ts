// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { ProgramFile, Tag, TagFile } from '@shared/ipc'
import { formatProgramFile } from '@shared/program-file'
import demo from '../../../../../../projects/demo/tags.json'
import { useSequence } from '../../stores/sequence.store'
import { makeStep, newFlow } from './flow'
import { defaultFlow, fromProgram, makeEdge, newFlowName, programText, stationsOf, toProgram, type FlowDoc } from './program'

const tags = (demo as TagFile).tags as Tag[]

/** a flow like the design's S1_Main: Start → Wait → Decision (yes → End, no → Set → back to Wait) */
function sample(): FlowDoc {
  const base = newFlow().nodes
  const w = { ...makeStep('wait_di', base), id: 'n1' }
  w.data = { ...w.data, p: { tag: 'DI_S1_PartPresent', value: true, timeout_ms: 5000, alarm: 'A_301_NoPart' }, name: 'Part in', comment: 'sensor at the nest' }
  const d = { ...makeStep('if', [...base, w], { x: 0, y: 200 }), id: 'n2' }
  d.data = { ...d.data, p: { expr: 'R_PartCount >= 100' } }
  const s = { ...makeStep('set_do', [...base, w, d], { x: 320, y: 200 }), id: 'n3' }
  s.data = { ...s.data, p: { tag: 'DO_S1_ClampValve', value: true } }
  const edges = [makeEdge('start', 'n1'), makeEdge('n1', 'n2'), makeEdge('n2', 'end', 'yes'), makeEdge('n2', 'n3', 'no'), makeEdge('n3', 'n1')]
  return { name: 'S1_Main', station: 'S1', autostart: true, nodes: [...base, w, d, s], edges }
}

beforeEach(() => useSequence.getState().loadProgram(null, tags))

describe('N02 program.json (step 27)', () => {
  it('U-27.1 round trip: drawing → program.json text → drawing gives the same drawing and the same text', () => {
    const flows = [sample(), defaultFlow('S2', 'S2_Main')]
    const text = programText(flows)
    const back = fromProgram(JSON.parse(text) as ProgramFile)
    expect(back.errors).toEqual([])
    expect(back.flows).toEqual(flows)
    expect(programText(back.flows)).toBe(text)
  })

  it('U-27.2 the file: like the design (pos and links on one line), only what the user made, whole pixels', () => {
    const f = sample()
    f.nodes[2] = { ...f.nodes[2]!, position: { x: 10.4, y: 20.6 }, selected: true, measured: { width: 260, height: 54 } }
    const text = formatProgramFile(toProgram([f]))
    expect(text).toContain('"schema": "spm.program/1"')
    expect(text).toContain('"pos": [10, 21]')
    expect(text).toContain('["n2", "end", "yes"]')
    expect(text).toContain('["start", "n1"]')
    expect(text).not.toMatch(/selected|measured|smoothstep|markerEnd/)
    expect(text.endsWith('}\n')).toBe(true)
    expect(formatProgramFile(toProgram([f]), '\r\n')).toBe(text.replace(/\n/g, '\r\n'))
  })

  it('U-27.3 reading checks what the schema cannot: missing nodes, a yes out of a non-Decision, unknown types — the rest opens', () => {
    const file: ProgramFile = {
      schema: 'spm.program/1',
      flows: [
        {
          name: 'S1_Main',
          station: 'S1',
          nodes: [
            { id: 'start', type: 'start', pos: [0, 0] },
            { id: 'n1', type: 'delay', pos: [0, 96] },
            { id: 'n9', type: 'calc' as 'delay', pos: [0, 200] }
          ],
          edges: [['start', 'n1'], ['n1', 'nX'], ['start', 'n1', 'yes']]
        }
      ]
    }
    const r = fromProgram(file)
    expect(r.errors).toEqual([
      'S1_Main: node n9 has an unknown type calc',
      'S1_Main: link n1 → nX leads to a node that is not there',
      "S1_Main: link start → n1 ('yes') does not fit a start node"
    ])
    expect(r.flows[0]!.nodes.map((n) => n.id)).toEqual(['start', 'n1'])
    expect(r.flows[0]!.edges.map((e) => e.id)).toEqual(['e-start-n1'])
    expect(r.flows[0]!.nodes[1]!.data.p).toEqual({ ms: 500 }) // missing parameters get their defaults
    expect(r.flows[0]!.autostart).toBe(false)
  })

  it('U-27.4 tree helpers: stations from the tag scopes (not global), free flow names', () => {
    expect(stationsOf(tags, [])).toEqual(['S1', 'S2'])
    expect(stationsOf(undefined, [])).toEqual(['S1'])
    expect(stationsOf(undefined, [defaultFlow('S7', 'S7_Main')])).toEqual(['S7'])
    const flows = [defaultFlow('S1', 'S1_Main'), defaultFlow('S1', 'S1_Flow2')]
    expect(newFlowName(flows, 'S1')).toBe('S1_Flow3')
    expect(newFlowName(flows, 'S2')).toBe('S2_Main')
  })

  it('U-27.5 the store: several flows; switching keeps the drawing of the one left; a new flow is shown at once', () => {
    const s = useSequence.getState()
    const id = s.addStep('delay')
    s.addFlow('S1')
    expect(useSequence.getState().flows.map((f) => f.name)).toEqual(['S1_Main', 'S1_Flow2'])
    expect(useSequence.getState().active).toBe(1)
    expect(useSequence.getState().nodes.map((n) => n.id)).toEqual(['start', 'end'])
    useSequence.getState().selectFlow(0)
    expect(useSequence.getState().nodes.map((n) => n.id)).toEqual(['start', 'end', id])
    expect(useSequence.getState().currentFlows()[1]!.nodes).toHaveLength(2)
  })

  it('U-27.6 loading a project: its program, or one empty flow for the first station that is not a change yet', () => {
    const errors = useSequence.getState().loadProgram(toProgram([sample()]), tags)
    expect(errors).toEqual([])
    expect(useSequence.getState().nodes.map((n) => n.id)).toEqual(['start', 'end', 'n1', 'n2', 'n3'])
    expect(programText(useSequence.getState().currentFlows())).toBe(useSequence.getState().saved)
    useSequence.getState().loadProgram(null, tags)
    expect(useSequence.getState().flows.map((f) => [f.name, f.station])).toEqual([['S1_Main', 'S1']])
    expect(programText(useSequence.getState().currentFlows())).toBe(useSequence.getState().saved)
  })
})
