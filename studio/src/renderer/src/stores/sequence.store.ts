/**
 * Sequence store (N02, step 23): the flow on the canvas. Kept here (not in the screen) so it survives
 * switching screens. In memory only until program.json (step 27).
 */
import { create } from 'zustand'
import { addEdge, MarkerType, type Connection, type Edge, type EdgeChangeset, type NodeChangeset } from '@xyflow/react'
import { connectProblem, edgeId, makeStep, newFlow, type FlowNode, type StepKind, type Terminal } from '../features/sequence/flow'
import { toast } from './feedback.store'

interface SequenceState {
  nodes: FlowNode[]
  edges: Edge[]
  /** React Flow 13: changes come as a changeset that applies itself (applyNodeChanges of v12 is gone) */
  onNodesChange: (changes: NodeChangeset<FlowNode>) => void
  onEdgesChange: (changes: EdgeChangeset<Edge>) => void
  /** a link drawn by the user; refused ones say why */
  connect: (c: Connection) => boolean
  reset: () => void
  /** step 24: a node from the palette — at the drop point, or below the lowest node; returns its id */
  addStep: (type: StepKind | Terminal, at?: { x: number; y: number }) => string
  /** step 25: change parameters / name / comment of one node (the property panel) */
  updateNode: (id: string, patch: Partial<Pick<FlowNode['data'], 'p' | 'name' | 'comment'>>) => void
  /** step 26: Build output → select that node only (the property panel shows it) */
  selectOnly: (id: string) => void
}

export const useSequence = create<SequenceState>((set, get) => ({
  ...newFlow(),
  onNodesChange: (changes) => set({ nodes: changes.applyTo(get().nodes) }),
  onEdgesChange: (changes) => set({ edges: changes.applyTo(get().edges) }),
  connect: (c) => {
    const why = connectProblem(c, get().nodes, get().edges)
    if (why) {
      toast(`Not linked: ${why}`, 'error')
      return false
    }
    // a Decision's links say which way they are (step 26)
    const label = c.sourceHandle ?? undefined
    set({
      edges: addEdge(
        {
          ...c,
          id: edgeId(c),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          label,
          className: label ? `seq-edge-${label}` : undefined
        },
        get().edges
      )
    })
    return true
  },
  reset: () => set(newFlow()),
  addStep: (type, at) => {
    const n = makeStep(type, get().nodes, at)
    // the new node is the selected one (property panel, step 25)
    set({ nodes: [...get().nodes.map((x) => (x.selected ? { ...x, selected: false } : x)), { ...n, selected: true }] })
    return n.id
  },
  updateNode: (id, patch) => set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }),
  selectOnly: (id) => set({ nodes: get().nodes.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })) })
}))
