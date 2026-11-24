/**
 * N02 sequence editor — the flow model (step 23: Start and End only). Logic only, unit tested.
 * A flow is nodes + edges in React Flow's shape; later steps add node kinds (Move, Wait, Set, Delay … step 24)
 * and save it to program.json (step 27).
 */
import type { Connection, Edge, Node } from '@xyflow/react'

/** node types (Software implementation › 4a); the names are those of program.json (4c) */
export type StepKind = 'move_abs' | 'wait_di' | 'set_do' | 'delay' | 'if'
export type FlowNodeKind = 'start' | 'end' | StepKind

/** parameters per type — 'p' in program.json; empty strings = not chosen yet (property panel: step 25) */
export interface StepParams {
  move_abs: { axis: string; point: string; speed: number }
  wait_di: { tag: string; value: boolean; timeout_ms: number; alarm: string }
  set_do: { tag: string; value: boolean }
  delay: { ms: number }
  /** step 26: the condition (flow-expr.ts); yes / no are the two links out */
  if: { expr: string }
}

export interface FlowNodeData extends Record<string, unknown> {
  label: string
  p?: StepParams[StepKind]
  /** step 25: optional step name (shown as the title, like 'Clamp' in the design) and a comment */
  name?: string
  comment?: string
}

export type FlowNode = Node<FlowNodeData, FlowNodeKind>

/** grid the nodes snap to (px in flow coordinates) */
export const GRID = 16

/** what the palette offers, in palette order: title, op in the step table, shape, icon, what 'done' means */
export interface StepDef {
  type: StepKind
  title: string
  op: string
  shape: 'process' | 'condition' | 'delay' | 'decision'
  icon: 'motion' | 'wait' | 'output' | 'delay' | 'decision'
  done: string
}

export const STEP_DEFS: StepDef[] = [
  { type: 'move_abs', title: 'Move', op: 'MOVE_ABS', shape: 'process', icon: 'motion', done: 'axis in position' },
  { type: 'wait_di', title: 'Wait input', op: 'WAIT_DI', shape: 'condition', icon: 'wait', done: 'input = value (or timeout → alarm)' },
  { type: 'set_do', title: 'Set output', op: 'SET_DO', shape: 'process', icon: 'output', done: 'next cycle' },
  { type: 'delay', title: 'Delay', op: 'DELAY', shape: 'delay', icon: 'delay', done: 'time elapsed' },
  { type: 'if', title: 'Decision', op: 'IF', shape: 'decision', icon: 'decision', done: 'evaluated in one cycle → yes or no' }
]

export const stepDef = (t: StepKind): StepDef => STEP_DEFS.find((d) => d.type === t)!

/** a new step's parameters: safe values, tags still to be chosen */
export function defaultParams<K extends StepKind>(type: K): StepParams[K] {
  const d: { [T in StepKind]: StepParams[T] } = {
    move_abs: { axis: '', point: '', speed: 100 },
    wait_di: { tag: '', value: true, timeout_ms: 5000, alarm: '' },
    set_do: { tag: '', value: true },
    delay: { ms: 500 },
    if: { expr: '' }
  }
  return structuredClone(d[type])
}

const or = (v: string, missing: string): string => v || missing
const onOff = (v: boolean): string => (v ? 'TRUE' : 'FALSE')
const seconds = (ms: number): string => (ms % 1000 === 0 ? `${ms / 1000} s` : `${ms} ms`)

/** the one-line summary under the title (Software implementation › 4b: 'MOVE AX_S1_X → P_S1_Pick 80 %') */
export function summary(type: FlowNodeKind, p: FlowNodeData['p']): string {
  switch (type) {
    case 'move_abs': {
      const q = p as StepParams['move_abs']
      return `MOVE ${or(q.axis, 'axis?')} → ${or(q.point, 'point?')} · ${q.speed} %`
    }
    case 'wait_di': {
      const q = p as StepParams['wait_di']
      return `WAIT ${or(q.tag, 'input?')} = ${onOff(q.value)} · ${seconds(q.timeout_ms)}`
    }
    case 'set_do': {
      const q = p as StepParams['set_do']
      return `SET ${or(q.tag, 'output?')} := ${onOff(q.value)}`
    }
    case 'delay':
      return `DELAY ${seconds((p as StepParams['delay']).ms)}`
    case 'if':
      return `IF ${or((p as StepParams['if']).expr.trim(), 'condition?')}`
    default:
      return ''
  }
}

/** the ways out of a node: a Decision has 'yes' (bottom) and 'no' (right), every other node one, End none */
export function outlets(type: FlowNodeKind | undefined): (string | null)[] {
  if (type === 'if') return ['yes', 'no']
  if (type === 'end' || type === undefined) return []
  return [null]
}

/** next free node id: n1, n2 … (start / end keep their names) */
export function nextId(nodes: FlowNode[]): string {
  const used = nodes.map((n) => Number(/^n(\d+)$/.exec(n.id)?.[1] ?? 0))
  return `n${Math.max(0, ...used) + 1}`
}

export const snap = (v: number): number => Math.round(v / GRID) * GRID

/** a new step node; without a drop position it goes below the lowest node */
export function makeStep(type: StepKind | Terminal, nodes: FlowNode[], at?: { x: number; y: number }): FlowNode {
  const below = { x: 0, y: Math.max(0, ...nodes.map((n) => n.position.y)) + GRID * 6 }
  const pos = { x: snap((at ?? below).x), y: snap((at ?? below).y) }
  // step 26: more Start / End from the palette (a second End is fine, a second Start is a problem the rules show)
  if (type === 'start' || type === 'end')
    return { id: nextId(nodes), type, position: pos, data: { label: type === 'start' ? 'Start' : 'End' } }
  return { id: nextId(nodes), type, position: pos, data: { label: stepDef(type).title, p: defaultParams(type) } }
}

export type Terminal = 'start' | 'end'
/** palette entries for Start / End (Software implementation › 4a: 'Start / End · START, END') */
export const TERMINAL_DEFS: { type: Terminal; title: string; op: string; done: string }[] = [
  { type: 'start', title: 'Start', op: 'START', done: 'immediately — the flow begins here' },
  { type: 'end', title: 'End', op: 'END', done: 'immediately — the flow is finished' }
]

/** a new flow: Start at the top, End below it — not connected yet (the user draws the first link) */
export function newFlow(): { nodes: FlowNode[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' }, deletable: false },
      { id: 'end', type: 'end', position: { x: 0, y: GRID * 15 }, data: { label: 'End' }, deletable: false }
    ],
    edges: []
  }
}

/**
 * May this link be drawn? '' = yes, otherwise the reason (shown as a toast).
 * Rules: not to itself, not twice, nothing into Start, nothing out of End, each way out used once
 * (a Decision has two: yes and no — step 26).
 */
export function connectProblem(c: Connection | Edge, nodes: FlowNode[], edges: Edge[]): string {
  if (!c.source || !c.target) return 'a link needs two ends'
  if (c.source === c.target) return 'a node cannot link to itself'
  const kind = (id: string): FlowNodeKind | undefined => nodes.find((n) => n.id === id)?.type
  if (kind(c.target) === 'start') return 'nothing can lead into Start'
  if (kind(c.source) === 'end') return 'nothing can leave End'
  if (edges.some((e) => e.source === c.source && e.target === c.target)) return 'these two nodes are already linked'
  const handle = c.sourceHandle ?? null
  if (edges.some((e) => e.source === c.source && (e.sourceHandle ?? null) === handle))
    return handle ? `its '${handle}' way out is already linked` : 'this node already has its way out (a Decision has two: yes and no)'
  return ''
}

export const edgeId = (c: Pick<Edge, 'source' | 'target' | 'sourceHandle'>): string =>
  c.sourceHandle ? `e-${c.source}-${c.sourceHandle}-${c.target}` : `e-${c.source}-${c.target}`
