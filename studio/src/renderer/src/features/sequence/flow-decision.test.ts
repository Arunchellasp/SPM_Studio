// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedback } from '../../stores/feedback.store'
import { useSequence } from '../../stores/sequence.store'
import { connectProblem, outlets } from './flow'

const link = (source: string, target: string, sourceHandle: string | null = null) => ({ source, target, sourceHandle, targetHandle: null })

beforeEach(() => {
  useSequence.getState().reset()
  useFeedback.setState({ toasts: [] })
})

describe('N02 Decision links (step 26)', () => {
  it('U-26.10 ways out per node: Decision yes + no, End none, every other node one', () => {
    expect(outlets('if')).toEqual(['yes', 'no'])
    expect(outlets('end')).toEqual([])
    expect(outlets('start')).toEqual([null])
    expect(outlets('delay')).toEqual([null])
  })

  it("U-26.11 the store labels a Decision's links yes / no, keeps them apart and refuses a second 'yes'", () => {
    const s = useSequence.getState()
    const d = s.addStep('if')
    const x = s.addStep('delay')
    expect(s.connect(link(d, 'end', 'yes'))).toBe(true)
    expect(s.connect(link(d, x, 'no'))).toBe(true)
    const edges = useSequence.getState().edges
    expect(edges.map((e) => [e.id, e.label])).toEqual([
      [`e-${d}-yes-end`, 'yes'],
      [`e-${d}-no-${x}`, 'no']
    ])
    const y = s.addStep('set_do')
    expect(connectProblem(link(d, x, 'yes'), useSequence.getState().nodes, edges)).toBe('these two nodes are already linked')
    expect(connectProblem(link(d, y, 'yes'), useSequence.getState().nodes, edges)).toBe("its 'yes' way out is already linked")
    expect(s.connect(link(d, y, 'yes'))).toBe(false)
    expect(useFeedback.getState().toasts.at(-1)?.text).toBe("Not linked: its 'yes' way out is already linked")
  })

  it('U-26.12 Start and End from the palette: new ids, deletable (the first Start / End stay protected)', () => {
    const s = useSequence.getState()
    const a = s.addStep('start')
    const b = s.addStep('end')
    const n = useSequence.getState().nodes
    expect(n.find((x) => x.id === a)).toMatchObject({ type: 'start', data: { label: 'Start' } })
    expect(n.find((x) => x.id === a)?.deletable).toBeUndefined()
    expect(n.find((x) => x.id === b)).toMatchObject({ type: 'end', data: { label: 'End' } })
    expect(n.find((x) => x.id === 'start')?.deletable).toBe(false)
  })
})
