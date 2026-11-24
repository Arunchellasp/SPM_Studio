/**
 * N02 auto-layout (step 28): a messy flow tidied in one click (Software implementation › 4b.8:
 * 'Auto-layout button (elkjs, free) for tidy top-to-bottom drawings'). Logic only, unit tested.
 *
 * ELK 'layered' puts the nodes in rows from Start downwards, keeps links short and avoids crossings.
 * Each node gets its dots as ELK ports on fixed sides — in on top, out at the bottom, a Decision's 'no' on the
 * right — so ELK places the nodes for the links as the canvas really draws them. Positions snap to the grid.
 *
 * Loops (no → … → back to an earlier step) must be cut somewhere to make rows. ELK is given the nodes in flow
 * order (following the links from Start) and cuts by that order, so the link that really goes BACK is the one
 * turned round — not the 'no' branch (first test run: the branch landed above Wait, Start beside it).
 * Start is pinned to the first row, End to the last.
 */
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { Edge } from '@xyflow/react'
import { GRID, outlets, snap, type FlowNode } from './flow'

/** the node sizes of the design (tokens.css: --seq-terminal-*, --seq-step-*, --seq-decision-h) */
export function nodeSize(n: FlowNode): { width: number; height: number } {
  if (n.measured?.width && n.measured.height) return { width: n.measured.width, height: n.measured.height }
  if (n.type === 'start' || n.type === 'end') return { width: GRID * 10, height: GRID * 3 - 4 }
  if (n.type === 'if') return { width: GRID * 16 + 4, height: GRID * 5 }
  return { width: GRID * 16 + 4, height: GRID * 3 + 6 }
}

/** space between rows and between nodes side by side (canvas px) */
export const ROW_GAP = GRID * 3
export const COL_GAP = GRID * 4

const elk = new ELK()

/** the nodes in flow order: from each Start along the links (breadth first), then whatever no link reaches */
export function flowOrder(nodes: FlowNode[], edges: Edge[]): FlowNode[] {
  const seen = new Set<string>()
  const out: FlowNode[] = []
  const queue = nodes.filter((n) => n.type === 'start')
  while (queue.length) {
    const n = queue.shift()!
    if (seen.has(n.id)) continue
    seen.add(n.id)
    out.push(n)
    // 'yes' before 'no' before the rest, so the main line comes first
    const next = edges.filter((e) => e.source === n.id).sort((a, b) => (a.sourceHandle === 'no' ? 1 : 0) - (b.sourceHandle === 'no' ? 1 : 0))
    for (const e of next) {
      const t = nodes.find((x) => x.id === e.target)
      if (t && !seen.has(t.id)) queue.push(t)
    }
  }
  return [...out, ...nodes.filter((n) => !seen.has(n.id))]
}
const port = (node: string, handle: string): string => `${node}::${handle}`

/** new top-left positions for every node (by id); the flow itself is not changed */
export async function autoLayout(nodes: FlowNode[], edges: Edge[]): Promise<Map<string, { x: number; y: number }>> {
  const graph: ElkNode = {
    id: 'flow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ROW_GAP),
      'elk.spacing.nodeNode': String(COL_GAP),
      'elk.spacing.edgeNode': String(GRID),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // straight lines where it can
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', // keep the flow order where it does not matter
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER' // cut loops at the link that goes back in flow order
    },
    children: flowOrder(nodes, edges).map((n) => ({
      id: n.id,
      ...nodeSize(n),
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        ...(n.type === 'start' ? { 'elk.layered.layering.layerConstraint': 'FIRST' } : {}),
        ...(n.type === 'end' ? { 'elk.layered.layering.layerConstraint': 'LAST' } : {})
      },
      ports: [
        ...(n.type === 'start' ? [] : [{ id: port(n.id, 'in'), layoutOptions: { 'elk.port.side': 'NORTH' } }]),
        ...outlets(n.type).map((h) => ({ id: port(n.id, h ?? 'out'), layoutOptions: { 'elk.port.side': h === 'no' ? 'EAST' : 'SOUTH' } }))
      ]
    })),
    edges: edges.map((e) => ({ id: e.id, sources: [port(e.source, e.sourceHandle ?? 'out')], targets: [port(e.target, 'in')] }))
  }
  const out = await elk.layout(graph)
  return new Map((out.children ?? []).map((c) => [c.id, { x: snap(c.x ?? 0), y: snap(c.y ?? 0) }]))
}
