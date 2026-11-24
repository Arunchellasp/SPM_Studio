/**
 * N02 save / load (step 27): the drawing ⇄ program.json (Software implementation › 4c). Logic only, unit tested —
 * the roadmap's test is the round trip: what is saved and read back is the same drawing.
 *
 *   drawing (React Flow)                       program.json
 *   node { id, type, position, data: { p, name, comment } }  →  { id, type, pos: [x, y], p, name, comment }
 *   edge { source, target, sourceHandle }                    →  [source, target] or [source, target, 'yes' | 'no']
 *
 * Only what the user made is saved: selection, measured sizes and edge styling are rebuilt on load.
 */
import { MarkerType, type Edge } from '@xyflow/react'
import type { ProgramFile, ProgramNode, Tag } from '@shared/ipc'
import { emptyProgram, formatProgramFile, PROGRAM_SCHEMA } from '@shared/program-file'
import { defaultParams, edgeId, newFlow, outlets, STEP_DEFS, stepDef, type FlowNode, type FlowNodeKind, type StepKind } from './flow'

/** one flow of the project: a station's sequence (e.g. S1_Main) */
export interface FlowDoc {
  name: string
  station: string
  autostart: boolean
  nodes: FlowNode[]
  edges: Edge[]
}

/** a link as the canvas draws it — the same look whether drawn by hand or read from the file */
export function makeEdge(source: string, target: string, sourceHandle: string | null = null): Edge {
  const label = sourceHandle ?? undefined
  return {
    id: edgeId({ source, target, sourceHandle }),
    source,
    target,
    sourceHandle,
    targetHandle: null,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(label ? { label, className: `seq-edge-${label}` } : {})
  }
}

/** a new flow for a station: Start above End (step 23), nothing linked */
export function defaultFlow(station: string, name: string): FlowDoc {
  return { name, station, autostart: false, ...newFlow() }
}

/** a free flow name for a station: S1_Main first, then S1_Flow2, S1_Flow3 … */
export function newFlowName(flows: FlowDoc[], station: string): string {
  const used = new Set(flows.map((f) => f.name))
  if (!used.has(`${station}_Main`)) return `${station}_Main`
  for (let i = 2; ; i++) if (!used.has(`${station}_Flow${i}`)) return `${station}_Flow${i}`
}

/** the stations of the tree: tag scopes (not 'global') and the stations of existing flows; S1 when there are none */
export function stationsOf(tags: Tag[] | undefined, flows: FlowDoc[]): string[] {
  const s = new Set<string>([
    ...(tags ?? []).map((t) => t.scope as string).filter((x) => x && x !== 'global'),
    ...flows.map((f) => f.station)
  ])
  return s.size ? [...s].sort() : ['S1']
}

const round = (v: number): number => Math.round(v)

/** the drawing → program.json (flows in tree order; nodes and links in drawing order) */
export function toProgram(flows: FlowDoc[]): ProgramFile {
  return {
    schema: PROGRAM_SCHEMA,
    flows: flows.map((f) => ({
      name: f.name,
      station: f.station,
      autostart: f.autostart,
      nodes: f.nodes.map((n) => {
        const out: ProgramNode = { id: n.id, type: n.type as ProgramNode['type'], pos: [round(n.position.x), round(n.position.y)] }
        if (n.data.p) out.p = n.data.p
        if (n.data.name) out.name = n.data.name
        if (n.data.comment) out.comment = n.data.comment
        return out
      }),
      edges: f.edges.map((e) => (e.sourceHandle ? [e.source, e.target, e.sourceHandle] : [e.source, e.target]))
    }))
  }
}

const KINDS = new Set<string>(['start', 'end', ...STEP_DEFS.map((d) => d.type)])

/**
 * program.json → the drawing. The schema was checked by main; this adds what the schema cannot say
 * (a link to a node that is not there, 'yes' out of a node that is no Decision …). Such parts are left out
 * and listed in `errors` — the rest of the drawing still opens.
 */
export function fromProgram(file: ProgramFile | null): { flows: FlowDoc[]; errors: string[] } {
  const errors: string[] = []
  const flows = (file ?? emptyProgram()).flows.map((f): FlowDoc => {
    const nodes: FlowNode[] = []
    for (const n of f.nodes) {
      if (!KINDS.has(n.type)) {
        errors.push(`${f.name}: node ${n.id} has an unknown type ${n.type}`)
        continue
      }
      const type = n.type as FlowNodeKind
      const terminal = type === 'start' || type === 'end'
      nodes.push({
        id: n.id,
        type,
        position: { x: n.pos[0], y: n.pos[1] },
        data: {
          label: terminal ? (type === 'start' ? 'Start' : 'End') : stepDef(type as StepKind).title,
          ...(terminal ? {} : { p: { ...defaultParams(type as StepKind), ...(n.p as object) } }),
          ...(n.name ? { name: n.name } : {}),
          ...(n.comment ? { comment: n.comment } : {})
        },
        // the first Start / End of a flow stay protected, as on a new flow (step 23)
        ...(n.id === 'start' || n.id === 'end' ? { deletable: false } : {})
      })
    }
    const edges: Edge[] = []
    for (const [source, target, way] of f.edges.map((e) => [e[0], e[1], e[2] ?? null] as const)) {
      const from = nodes.find((n) => n.id === source)
      if (!from || !nodes.some((n) => n.id === target)) {
        errors.push(`${f.name}: link ${source} → ${target} leads to a node that is not there`)
        continue
      }
      if (!outlets(from.type).includes(way)) {
        errors.push(`${f.name}: link ${source} → ${target}${way ? ` ('${way}')` : ''} does not fit a ${from.type} node`)
        continue
      }
      edges.push(makeEdge(source, target, way))
    }
    return { name: f.name, station: f.station, autostart: f.autostart ?? false, nodes, edges }
  })
  return { flows, errors }
}

/** the text program.json would have — used to tell whether there are unsaved changes */
export const programText = (flows: FlowDoc[]): string => formatProgramFile(toProgram(flows))
