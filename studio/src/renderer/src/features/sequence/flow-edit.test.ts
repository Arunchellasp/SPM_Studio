// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useSequence, FLOW_UNDO_STEPS } from '../../stores/sequence.store'
import { autoLayout, nodeSize } from './auto-layout'
import { makeStep, newFlow, type FlowNode } from './flow'
import { copySelection, pasteClip, PASTE_SHIFT } from './flow-edit'
import { makeEdge } from './program'

const link = (source: string, target: string, sourceHandle: string | null = null) => ({ source, target, sourceHandle, targetHandle: null })
const ids = (): string[] => useSequence.getState().nodes.map((n) => n.id)

beforeEach(() => useSequence.getState().loadProgram(null))

describe('N02 undo / redo (step 28)', () => {
  it('U-28.1 every change of the store is one undo step; undo / redo walk back and forth; a new change ends redo', () => {
    const s = useSequence.getState()
    const a = s.addStep('delay')
    s.connect(link('start', a))
    s.updateNode(a, { name: 'Settle' })
    expect(useSequence.getState().past).toHaveLength(3)
    expect(useSequence.getState().undo()).toBe(true) // name back
    expect(useSequence.getState().nodes.find((n) => n.id === a)?.data.name).toBeUndefined()
    expect(useSequence.getState().undo()).toBe(true) // link gone
    expect(useSequence.getState().edges).toEqual([])
    expect(useSequence.getState().redo()).toBe(true) // link back
    expect(useSequence.getState().edges).toHaveLength(1)
    useSequence.getState().addStep('set_do') // new change: the undone name cannot be redone any more
    expect(useSequence.getState().redo()).toBe(false)
    while (useSequence.getState().undo());
    expect(ids()).toEqual(['start', 'end'])
    expect(useSequence.getState().undo()).toBe(false)
  })

  it(`U-28.2 at most ${FLOW_UNDO_STEPS} steps are kept; a refused link is no step; switching flow starts a fresh history`, () => {
    for (let i = 0; i < FLOW_UNDO_STEPS + 5; i++) useSequence.getState().addStep('delay')
    expect(useSequence.getState().past).toHaveLength(FLOW_UNDO_STEPS)
    const before = useSequence.getState().past.length
    expect(useSequence.getState().connect(link('end', 'start'))).toBe(false)
    expect(useSequence.getState().past).toHaveLength(before)
    useSequence.getState().addFlow('S1')
    expect(useSequence.getState().past).toEqual([])
  })

  it('U-28.3 a drag is one step (recorded at its start); a click without moving leaves no step', () => {
    const s = useSequence.getState()
    s.record() // drag start
    s.dropIfUnmoved() // drag stop, nothing moved
    expect(useSequence.getState().past).toHaveLength(0)
    s.record()
    useSequence.setState({ nodes: useSequence.getState().nodes.map((n) => (n.id === 'end' ? { ...n, position: { x: 64, y: 400 } } : n)) })
    s.dropIfUnmoved()
    expect(useSequence.getState().past).toHaveLength(1)
    useSequence.getState().undo()
    expect(useSequence.getState().nodes.find((n) => n.id === 'end')?.position).toEqual({ x: 0, y: 240 })
  })
})

describe('N02 copy / paste (step 28)', () => {
  const flow = (): { nodes: FlowNode[]; edges: ReturnType<typeof makeEdge>[] } => {
    const base = newFlow().nodes
    const d = { ...makeStep('if', base), id: 'n1', selected: true }
    const w = { ...makeStep('delay', [...base, d], { x: 300, y: 96 }), id: 'n2', selected: true }
    return {
      nodes: [{ ...base[0]!, selected: true }, base[1]!, d, w],
      edges: [makeEdge('start', 'n1'), makeEdge('n1', 'n2', 'no'), makeEdge('n1', 'end', 'yes')]
    }
  }

  it('U-28.4 copy keeps ids unique: new ids, links only between the copies (re-pointed), a step down-right, selected', () => {
    const f = flow()
    const clip = copySelection(f.nodes, f.edges)!
    expect(clip.nodes.map((n) => n.id)).toEqual(['start', 'n1', 'n2'])
    expect(clip.edges.map((e) => e.id)).toEqual(['e-start-n1', 'e-n1-no-n2']) // n1 → end left out: End was not copied
    const r = pasteClip(clip, f.nodes, f.edges)
    expect(r.ids).toEqual(['n3', 'n4', 'n5'])
    const all = r.nodes.map((n) => n.id)
    expect(new Set(all).size).toBe(all.length)
    expect(r.edges.slice(3).map((e) => [e.id, e.label])).toEqual([
      ['e-n3-n4', undefined],
      ['e-n4-no-n5', 'no']
    ])
    expect(r.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['n3', 'n4', 'n5'])
    const src = f.nodes.find((n) => n.id === 'n2')!.position
    expect(r.nodes.find((n) => n.id === 'n5')!.position).toEqual({ x: src.x + PASTE_SHIFT, y: src.y + PASTE_SHIFT })
    expect(r.nodes.find((n) => n.id === 'n3')!.deletable).toBeUndefined() // a copied Start is an ordinary node
  })

  it('U-28.5 the store: Ctrl+C / Ctrl+V twice → two sets of copies with unique ids, one undo step each', () => {
    const s = useSequence.getState()
    const a = s.addStep('delay')
    s.updateNode(a, { name: 'Settle' })
    expect(useSequence.getState().copy()).toBe(1)
    const p1 = useSequence.getState().paste()
    const p2 = useSequence.getState().paste()
    expect([p1, p2]).toEqual([['n2'], ['n3']])
    const n = useSequence.getState().nodes
    expect(n.find((x) => x.id === 'n3')!.data.name).toBe('Settle')
    expect(n.find((x) => x.id === 'n3')!.position.y - n.find((x) => x.id === 'n2')!.position.y).toBe(PASTE_SHIFT)
    useSequence.getState().undo()
    expect(ids()).toEqual(['start', 'end', a, 'n2'])
    expect(useSequence.getState().copy()).toBe(1) // n2 is selected after its paste
    useSequence.setState({ nodes: useSequence.getState().nodes.map((x) => ({ ...x, selected: false })) })
    expect(useSequence.getState().copy()).toBe(0)
  })
})

describe('N02 auto-layout (step 28)', () => {
  it('U-28.6 a messy flow is tidied: top to bottom along the links, nothing overlaps, on the grid; no goes to the side', async () => {
    const base = newFlow().nodes
    const mk = (type: Parameters<typeof makeStep>[0], id: string, x: number, y: number): FlowNode => ({
      ...makeStep(type, base),
      id,
      position: { x, y }
    })
    // scattered on purpose: End at the top, the steps all over
    const nodes = [
      { ...base[0]!, position: { x: 700, y: 500 } },
      { ...base[1]!, position: { x: 0, y: 0 } },
      mk('wait_di', 'n1', 40, 620),
      mk('if', 'n2', 900, 30),
      mk('set_do', 'n3', 300, 300),
      mk('delay', 'n4', 320, 310) // overlaps n3
    ]
    const edges = [
      makeEdge('start', 'n1'),
      makeEdge('n1', 'n2'),
      makeEdge('n2', 'end', 'yes'),
      makeEdge('n2', 'n3', 'no'),
      makeEdge('n3', 'n4'),
      makeEdge('n4', 'n1')
    ]
    const pos = await autoLayout(nodes, edges)
    const box = (id: string) => ({ ...pos.get(id)!, ...nodeSize(nodes.find((n) => n.id === id)!) })
    const y = (id: string) => pos.get(id)!.y
    expect(y('start')).toBeLessThan(y('n1'))
    expect(y('n1')).toBeLessThan(y('n2'))
    expect(y('n2')).toBeLessThan(y('end'))
    expect(pos.get('n3')!.x).toBeGreaterThan(pos.get('n2')!.x) // 'no' leaves to the right
    for (const id of pos.keys()) expect([pos.get(id)!.x % 16, pos.get(id)!.y % 16].map(Math.abs)).toEqual([0, 0])
    const list = [...pos.keys()].map(box)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
  })

  it('U-28.7 the store applies a layout as one undo step', async () => {
    const s = useSequence.getState()
    s.connect(link('start', 'end'))
    const before = useSequence.getState().nodes.map((n) => n.position)
    s.applyLayout(await autoLayout(useSequence.getState().nodes, useSequence.getState().edges))
    useSequence.getState().undo()
    expect(useSequence.getState().nodes.map((n) => n.position)).toEqual(before)
  })
})
