/**
 * N02 sequence editor — the flow model (step 23: Start and End only). Logic only, unit tested.
 * A flow is nodes + edges in React Flow's shape; later steps add node kinds (Move, Wait, Set, Delay … step 24)
 * and save it to program.json (step 27).
 */
import type { Connection, Edge, Node } from '@xyflow/react'

export type FlowNodeKind = 'start' | 'end'

export interface FlowNodeData extends Record<string, unknown> {
  label: string
}

export type FlowNode = Node<FlowNodeData, FlowNodeKind>

/** grid the nodes snap to (px in flow coordinates) */
export const GRID = 16

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
 * Rules now: not to itself, not twice, nothing into Start, nothing out of End, one way out of each node.
 * (Branches come with the decision node, step 26.)
 */
export function connectProblem(c: Connection | Edge, nodes: FlowNode[], edges: Edge[]): string {
  if (!c.source || !c.target) return 'a link needs two ends'
  if (c.source === c.target) return 'a node cannot link to itself'
  const kind = (id: string): FlowNodeKind | undefined => nodes.find((n) => n.id === id)?.type
  if (kind(c.target) === 'start') return 'nothing can lead into Start'
  if (kind(c.source) === 'end') return 'nothing can leave End'
  if (edges.some((e) => e.source === c.source && e.target === c.target)) return 'these two nodes are already linked'
  if (edges.some((e) => e.source === c.source)) return 'this node already has its way out (branches come with the decision node)'
  return ''
}

export const edgeId = (c: Pick<Edge, 'source' | 'target'>): string => `e-${c.source}-${c.target}`
