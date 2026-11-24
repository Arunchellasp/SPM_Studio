/**
 * N02 editing comfort (step 28): copy / paste of nodes — logic only, unit tested.
 * Copy takes the selected nodes and the links BETWEEN them (a link to a node left behind would dangle).
 * Paste gives every node a new free id (n7, n8 …), keeps the links between the copies, puts them a little
 * down-right of the originals (on the grid) and selects them, so they can be dragged away at once.
 */
import type { Edge } from '@xyflow/react'
import { GRID, nextId, snap, type FlowNode } from './flow'
import { makeEdge } from './program'

export interface Clip {
  nodes: FlowNode[]
  edges: Edge[]
}

/** the selected nodes and the links between them; null when nothing is selected */
export function copySelection(nodes: FlowNode[], edges: Edge[]): Clip | null {
  const picked = nodes.filter((n) => n.selected)
  if (!picked.length) return null
  const ids = new Set(picked.map((n) => n.id))
  return {
    nodes: picked.map((n) => structuredClone({ ...n, selected: false, measured: undefined, dragging: undefined })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e }))
  }
}

/** the step between pastes: two grid squares right and down, so a copy never hides its original */
export const PASTE_SHIFT = GRID * 2

/**
 * The clip added to the flow with new ids. `times` = how often it was pasted already (each paste lands a step
 * further). The pasted nodes are the selected ones afterwards. A copied Start / End is an ordinary, deletable node.
 */
export function pasteClip(clip: Clip, nodes: FlowNode[], edges: Edge[], times = 1): { nodes: FlowNode[]; edges: Edge[]; ids: string[] } {
  const idMap = new Map<string, string>()
  const all = nodes.map((n) => (n.selected ? { ...n, selected: false } : n))
  const added: FlowNode[] = []
  for (const n of clip.nodes) {
    const id = nextId([...all, ...added])
    idMap.set(n.id, id)
    const { deletable: _protected, ...rest } = structuredClone(n)
    added.push({
      ...rest,
      id,
      selected: true,
      position: { x: snap(n.position.x + PASTE_SHIFT * times), y: snap(n.position.y + PASTE_SHIFT * times) }
    })
  }
  const newEdges = clip.edges.map((e) => makeEdge(idMap.get(e.source)!, idMap.get(e.target)!, e.sourceHandle ?? null))
  return {
    nodes: [...all, ...added],
    edges: [...edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...newEdges],
    ids: added.map((n) => n.id)
  }
}
