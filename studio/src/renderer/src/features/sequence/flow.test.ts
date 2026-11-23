// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedback } from '../../stores/feedback.store'
import { useSequence } from '../../stores/sequence.store'
import { connectProblem, defaultParams, makeStep, newFlow, nextId, STEP_DEFS, summary } from './flow'

const { nodes } = newFlow()
const link = (source: string, target: string) => ({ source, target, sourceHandle: null, targetHandle: null })

beforeEach(() => {
  useSequence.getState().reset()
  useFeedback.setState({ toasts: [] })
})

describe('N02 flow (step 23)', () => {
  it('U-23.1 a new flow: Start above End, not linked, neither can be deleted', () => {
    expect(nodes.map((n) => [n.id, n.type, n.position.y])).toEqual([
      ['start', 'start', 0],
      ['end', 'end', 240]
    ])
    expect(nodes.every((n) => n.deletable === false)).toBe(true)
    expect(newFlow().edges).toEqual([])
  })

  it('U-23.2 link rules: Start → End yes; to itself, into Start, out of End, twice — no, with the reason', () => {
    expect(connectProblem(link('start', 'end'), nodes, [])).toBe('')
    expect(connectProblem(link('start', 'start'), nodes, [])).toBe('a node cannot link to itself')
    expect(connectProblem(link('end', 'start'), nodes, [])).toBe('nothing can lead into Start')
    const one = [{ id: 'e', ...link('start', 'end') }]
    expect(connectProblem(link('start', 'end'), nodes, one)).toBe('these two nodes are already linked')
  })

  it('U-23.3 the store draws allowed links (arrow at the end) and refuses others with a toast', () => {
    expect(useSequence.getState().connect(link('start', 'end'))).toBe(true)
    expect(useSequence.getState().edges).toEqual([
      expect.objectContaining({ id: 'e-start-end', source: 'start', target: 'end', type: 'smoothstep', markerEnd: { type: 'arrowclosed' } })
    ])
    expect(useSequence.getState().connect(link('end', 'start'))).toBe(false)
    expect(useFeedback.getState().toasts.at(-1)?.text).toBe('Not linked: nothing can lead into Start')
    useSequence.getState().reset()
    expect(useSequence.getState().edges).toEqual([])
  })
})

describe('N02 node types (step 24)', () => {
  it('U-24.1 node defaults per type (the parameters program.json will save)', () => {
    expect(defaultParams('move_abs')).toEqual({ axis: '', point: '', speed: 100 })
    expect(defaultParams('wait_di')).toEqual({ tag: '', value: true, timeout_ms: 5000, alarm: '' })
    expect(defaultParams('set_do')).toEqual({ tag: '', value: true })
    expect(defaultParams('delay')).toEqual({ ms: 500 })
    expect(defaultParams('delay')).not.toBe(defaultParams('delay')) // a fresh copy each time
    expect(STEP_DEFS.map((d) => `${d.title}:${d.op}:${d.shape}`)).toEqual([
      'Move:MOVE_ABS:process',
      'Wait input:WAIT_DI:condition',
      'Set output:SET_DO:process',
      'Delay:DELAY:delay'
    ])
  })

  it('U-24.2 summary line: open parameters show ?, values as the runtime will use them', () => {
    expect(summary('move_abs', defaultParams('move_abs'))).toBe('MOVE axis? → point? · 100 %')
    expect(summary('move_abs', { axis: 'AX_S1_X', point: 'P_S1_Pick', speed: 80 })).toBe('MOVE AX_S1_X → P_S1_Pick · 80 %')
    expect(summary('wait_di', { tag: 'DI_S1_PartPresent', value: true, timeout_ms: 5000, alarm: '' })).toBe('WAIT DI_S1_PartPresent = TRUE · 5 s')
    expect(summary('set_do', { tag: 'DO_S1_ClampValve', value: false })).toBe('SET DO_S1_ClampValve := FALSE')
    expect(summary('delay', { ms: 300 })).toBe('DELAY 300 ms')
    expect(summary('start', undefined)).toBe('')
  })

  it('U-24.3 new nodes: free ids, snapped to the grid, below the lowest node when not dropped', () => {
    const { nodes: n0 } = newFlow()
    const a = makeStep('delay', n0)
    expect(a).toMatchObject({ id: 'n1', type: 'delay', position: { x: 0, y: 240 + 96 }, data: { label: 'Delay', p: { ms: 500 } } })
    const b = makeStep('move_abs', [...n0, a], { x: 101, y: 57 })
    expect(b).toMatchObject({ id: 'n2', position: { x: 96, y: 64 } })
    expect(nextId([...n0, a, { ...b, id: 'n7' }])).toBe('n8')
  })

  it('U-24.4 the store adds a step selected (others deselected) and links it like any node', () => {
    const id = useSequence.getState().addStep('wait_di')
    const id2 = useSequence.getState().addStep('set_do')
    const nodes = useSequence.getState().nodes
    expect(nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([id2])
    expect(useSequence.getState().connect(link('start', id))).toBe(true)
    expect(useSequence.getState().connect(link(id, id2))).toBe(true)
    expect(useSequence.getState().connect(link(id, 'end'))).toBe(false) // one way out
  })
})
