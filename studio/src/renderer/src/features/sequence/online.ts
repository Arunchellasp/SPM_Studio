/**
 * Step 34 · online view of N02 (pure): which node is the live step, the values under the nodes,
 * and the status text of the toolbar. The runtime sends pc per flow (state frames, evt 'step');
 * the compiled step table says which node each pc is (step.src). It only glows when the runtime
 * runs exactly the program the canvas compiled (same CRC) — otherwise a pc would point at the wrong node.
 */
import type { LinkState, Tag } from '@shared/ipc'
import type { RtFile } from '@shared/generated/rt'
import { parseExpr } from '@shared/expr'
import type { FlowNode } from './flow'

/** step event → node id: the node the flow `flowName` is in now, or null */
export function activeNode(rt: RtFile, flowName: string, pc: Record<string, number>): string | null {
  const f = rt.flows.find((x) => x.name === flowName)
  if (!f) return null
  const p = pc[String(f.id)]
  return p === undefined ? null : (f.steps[p]?.src ?? null)
}

export type OnlineKind = 'offline' | 'unbuilt' | 'other' | 'match'

export interface OnlineInput {
  link: LinkState
  /** CRC of the program in the runtime (undefined: not told yet) */
  prog: string | null | undefined
  rt: RtFile | null
  flowName: string
  pc: Record<string, number>
  values: Record<string, number | boolean | string>
  tags: readonly Tag[]
  nodes: readonly FlowNode[]
  links: number
  /** the canvas has changes that are not saved (so not in the downloaded program) */
  dirty: boolean
}

export interface OnlineView {
  kind: OnlineKind
  /** short, for the toolbar (the design: 'Online · scan 2 ms · 01_station') */
  text: string
  /** the whole sentence: the tooltip — always ends with the node and link counts (shown in the text since step 24) */
  title: string
  active: string | null
  /** node id → 'DI_S1_PartPresent = TRUE · …' */
  live: Record<string, string>
}

const show = (v: number | boolean | string | undefined): string =>
  v === undefined ? '–' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v)

/** the tags a node reads or writes (one value each): Wait / Set output → its tag; Decision → the tags of its condition */
export function nodeTags(n: FlowNode): string[] {
  const p: Record<string, unknown> = n.data.p ?? {}
  if ((n.type === 'wait_di' || n.type === 'set_do') && typeof p.tag === 'string' && p.tag) return [p.tag]
  if (n.type === 'if' && typeof p.expr === 'string') {
    const r = parseExpr(p.expr)
    return r.ok ? r.names : []
  }
  return []
}

export function onlineView(i: OnlineInput): OnlineView {
  const counts = `${i.nodes.length} nodes · ${i.links} ${i.links === 1 ? 'link' : 'links'}`
  const none = { active: null, live: {} }
  if (i.link !== 'online') return { kind: 'offline', text: `Offline · ${counts}`, title: `Runtime offline · ${counts}`, ...none }
  if (!i.rt)
    return { kind: 'unbuilt', text: 'Online · not built', title: `Online · not built yet — save the flows, then Download · ${counts}`, ...none }
  if (i.prog !== i.rt.crc)
    return i.prog
      ? {
          kind: 'other',
          text: 'Online · other program',
          title: `Online · the runtime runs another program (CRC ${i.prog}) — Download this one · ${counts}`,
          ...none
        }
      : { kind: 'other', text: 'Online · no program', title: `Online · no program in the runtime — Download · ${counts}`, ...none }
  const ids = new Map(i.tags.map((t, k) => [t.name, k]))
  const live: Record<string, string> = {}
  for (const n of i.nodes) {
    const names = nodeTags(n)
    if (names.length)
      live[n.id] = names.map((name) => `${name} = ${show(ids.has(name) ? i.values[String(ids.get(name))] : undefined)}`).join(' · ')
  }
  const active = activeNode(i.rt, i.flowName, i.pc)
  const f = i.rt.flows.find((x) => x.name === i.flowName)
  const step = f ? `step ${i.pc[String(f.id)] ?? 0}${active ? ` (${active})` : ''}` : 'flow not downloaded'
  const changed = i.dirty ? ' · changed' : ''
  return {
    kind: 'match',
    text: `Online · ${active ?? step}${changed}`, // short: the toolbar has little room (UI: 'Online · n2')
    title: `Online · the runtime runs this program (CRC ${i.rt.crc}) · ${f ? `${i.flowName} · ${step}` : `${i.flowName} is not in the downloaded program`}${i.dirty ? ' · the canvas has changed since the download' : ''} · ${counts}`,
    active,
    live
  }
}
