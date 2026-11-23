// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedback } from '../../stores/feedback.store'
import { useSequence } from '../../stores/sequence.store'
import { connectProblem, newFlow } from './flow'

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
