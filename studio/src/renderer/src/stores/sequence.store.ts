/**
 * Sequence store (N02, step 23): the flow on the canvas. Kept here (not in the screen) so it survives
 * switching screens. Step 27: a project has several flows (per station); `nodes` / `edges` are the one on
 * the canvas, the others wait in `flows`. `saved` is program.json's text as on disk → unsaved changes.
 */
import { create } from 'zustand'
import { addEdge, type Connection, type Edge, type EdgeChangeset, type NodeChangeset } from '@xyflow/react'
import type { ProgramFile, Tag } from '@shared/ipc'
import { connectProblem, makeStep, newFlow, type FlowNode, type StepKind, type Terminal } from '../features/sequence/flow'
import { defaultFlow, fromProgram, makeEdge, newFlowName, programText, stationsOf, type FlowDoc } from '../features/sequence/program'
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
  /** step 27: all flows of the project (the one on the canvas as it was when it was left) and which is shown */
  flows: FlowDoc[]
  active: number
  /** program.json as on disk (after open / save); unsaved changes = the drawing would give another text */
  saved: string
  /** all flows with the canvas's current drawing put back in — what Save writes */
  currentFlows: () => FlowDoc[]
  /** a project was opened: its program.json (null: none yet → one empty flow for the first station); returns problems */
  loadProgram: (file: ProgramFile | null, tags?: Tag[]) => string[]
  /** the tree: show another flow / add one to a station (shown at once) */
  selectFlow: (index: number) => void
  addFlow: (station: string) => void
  /** after a save: this text is now on disk */
  markSaved: (text: string) => void
}

const FIRST = [defaultFlow('S1', 'S1_Main')]

export const useSequence = create<SequenceState>((set, get) => ({
  nodes: FIRST[0]!.nodes,
  edges: FIRST[0]!.edges,
  flows: FIRST,
  active: 0,
  saved: programText(FIRST),
  onNodesChange: (changes) => set({ nodes: changes.applyTo(get().nodes) }),
  onEdgesChange: (changes) => set({ edges: changes.applyTo(get().edges) }),
  connect: (c) => {
    const why = connectProblem(c, get().nodes, get().edges)
    if (why) {
      toast(`Not linked: ${why}`, 'error')
      return false
    }
    // a Decision's links say which way they are (step 26); the same look as links read from program.json (step 27)
    set({ edges: addEdge(makeEdge(c.source, c.target, c.sourceHandle ?? null), get().edges) })
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
  selectOnly: (id) => set({ nodes: get().nodes.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })) }),

  currentFlows: () => {
    const { flows, active, nodes, edges } = get()
    return flows.map((f, i) => (i === active ? { ...f, nodes, edges } : f))
  },
  loadProgram: (file, tags) => {
    const { flows, errors } = fromProgram(file)
    const first = stationsOf(tags, [])[0] ?? 'S1'
    const list = flows.length ? flows : [defaultFlow(first, `${first}_Main`)]
    // saved = the file's own text when there is one (a new project: the empty flow is not a change yet)
    set({ flows: list, active: 0, nodes: list[0]!.nodes, edges: list[0]!.edges, saved: programText(file ? flows : list) })
    return errors
  },
  selectFlow: (index) => {
    const all = get().currentFlows()
    const f = all[index]
    if (!f || index === get().active) return
    set({ flows: all, active: index, nodes: f.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), edges: f.edges })
  },
  addFlow: (station) => {
    const all = get().currentFlows()
    const f = defaultFlow(station, newFlowName(all, station))
    set({ flows: [...all, f], active: all.length, nodes: f.nodes, edges: f.edges })
  },
  markSaved: (text) => set({ saved: text })
}))
