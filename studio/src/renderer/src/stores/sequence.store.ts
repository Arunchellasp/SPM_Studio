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
import { copySelection, pasteClip, type Clip } from '../features/sequence/flow-edit'
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
  /** step 28: undo / redo of the flow on the canvas — earlier drawings (newest last) and undone ones */
  past: Snap[]
  future: Snap[]
  /** remember the drawing before a change (the store's own actions do it; the canvas for drag and delete) */
  record: () => void
  /** a drag that did not move anything is no undo step */
  dropIfUnmoved: () => void
  undo: () => boolean
  redo: () => boolean
  /** copy / paste (Ctrl+C / Ctrl+V): the clip stays across flows; each paste lands a step further */
  clip: Clip | null
  pasted: number
  copy: () => number
  paste: () => string[]
  /** auto-layout result: new positions by node id (one undo step) */
  applyLayout: (pos: Map<string, { x: number; y: number }>) => void
  /** the canvas fits the view when this changes (after a layout — the toolbar is outside the canvas) */
  fitTick: number
}

/** one undo step: the flow on the canvas as it was */
export interface Snap {
  nodes: FlowNode[]
  edges: Edge[]
}

/** how many changes of a flow can be undone (as for tags, step 21) */
export const FLOW_UNDO_STEPS = 20

const NO_HISTORY = { past: [] as Snap[], future: [] as Snap[] }

const FIRST = [defaultFlow('S1', 'S1_Main')]

export const useSequence = create<SequenceState>((set, get) => ({
  nodes: FIRST[0]!.nodes,
  edges: FIRST[0]!.edges,
  flows: FIRST,
  active: 0,
  saved: programText(FIRST),
  ...NO_HISTORY,
  clip: null,
  pasted: 0,
  fitTick: 0,
  onNodesChange: (changes) => set({ nodes: changes.applyTo(get().nodes) }),
  onEdgesChange: (changes) => set({ edges: changes.applyTo(get().edges) }),
  connect: (c) => {
    const why = connectProblem(c, get().nodes, get().edges)
    if (why) {
      toast(`Not linked: ${why}`, 'error')
      return false
    }
    get().record()
    // a Decision's links say which way they are (step 26); the same look as links read from program.json (step 27)
    set({ edges: addEdge(makeEdge(c.source, c.target, c.sourceHandle ?? null), get().edges) })
    return true
  },
  reset: () => {
    get().record()
    set(newFlow())
  },
  addStep: (type, at) => {
    const n = makeStep(type, get().nodes, at)
    get().record()
    // the new node is the selected one (property panel, step 25)
    set({ nodes: [...get().nodes.map((x) => (x.selected ? { ...x, selected: false } : x)), { ...n, selected: true }] })
    return n.id
  },
  updateNode: (id, patch) => {
    get().record()
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) })
  },
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
    set({ flows: list, active: 0, nodes: list[0]!.nodes, edges: list[0]!.edges, saved: programText(file ? flows : list), ...NO_HISTORY })
    return errors
  },
  selectFlow: (index) => {
    const all = get().currentFlows()
    const f = all[index]
    if (!f || index === get().active) return
    // the history belongs to the flow on the canvas: switching starts a fresh one
    set({
      flows: all,
      active: index,
      nodes: f.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: f.edges,
      ...NO_HISTORY
    })
  },
  addFlow: (station) => {
    const all = get().currentFlows()
    const f = defaultFlow(station, newFlowName(all, station))
    set({ flows: [...all, f], active: all.length, nodes: f.nodes, edges: f.edges, ...NO_HISTORY })
  },
  markSaved: (text) => set({ saved: text }),

  record: () => {
    const { nodes, edges, past } = get()
    set({ past: [...past, { nodes, edges }].slice(-FLOW_UNDO_STEPS), future: [] })
  },
  dropIfUnmoved: () => {
    const { past, nodes } = get()
    const top = past.at(-1)
    if (!top) return
    const same =
      top.nodes.length === nodes.length &&
      top.nodes.every((n, i) => n.position.x === nodes[i]!.position.x && n.position.y === nodes[i]!.position.y)
    if (same) set({ past: past.slice(0, -1) })
  },
  undo: () => {
    const { past, future, nodes, edges } = get()
    const prev = past.at(-1)
    if (!prev) return false
    set({ ...prev, past: past.slice(0, -1), future: [...future, { nodes, edges }] })
    return true
  },
  redo: () => {
    const { past, future, nodes, edges } = get()
    const next = future.at(-1)
    if (!next) return false
    set({ ...next, future: future.slice(0, -1), past: [...past, { nodes, edges }] })
    return true
  },
  copy: () => {
    const clip = copySelection(get().nodes, get().edges)
    if (clip) set({ clip, pasted: 0 })
    return clip?.nodes.length ?? 0
  },
  paste: () => {
    const { clip, pasted, nodes, edges } = get()
    if (!clip) return []
    get().record()
    const r = pasteClip(clip, nodes, edges, pasted + 1)
    set({ nodes: r.nodes, edges: r.edges, pasted: pasted + 1 })
    return r.ids
  },
  applyLayout: (pos) => {
    get().record()
    set({ nodes: get().nodes.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n)), fitTick: get().fitTick + 1 })
  }
}))
