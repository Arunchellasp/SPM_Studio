/**
 * N02 flow validation (step 26) — logic only, every rule unit tested (flow.rules.test.ts).
 * Software implementation › 4b.5: 'Validation runs on every change: exactly one Start, every output connected,
 * tags exist, no unreachable node; errors shown as red badges.'
 *
 * Open parameters ('axis?', 'condition?') are not listed here: the dashed outline already shows them (step 24),
 * so a node that was just dropped does not turn red at once. The step table compiler (step 29) refuses them.
 */
import type { Edge } from '@xyflow/react'
import type { Tag } from '@shared/ipc'
import { compileExpr } from '@shared/expr'
import { parseCondition } from './flow-expr'
import { outlets, type FlowNode, type StepKind, type StepParams } from './flow'
import { FIELDS, tagsFor } from './node-schema'

export type RuleId = 'no-start' | 'two-starts' | 'no-end' | 'open-link' | 'unreachable' | 'unknown-tag' | 'bad-condition'

/** one problem; node = where the badge goes (null = the whole flow: status line and Build output only) */
export interface FlowIssue {
  rule: RuleId
  node: string | null
  message: string
}

type Rule = (nodes: FlowNode[], edges: Edge[], tags: Tag[] | undefined) => FlowIssue[]

const starts = (nodes: FlowNode[]): FlowNode[] => nodes.filter((n) => n.type === 'start')

/** exactly one Start: none → the flow cannot run; two or more → which one would run? (badge on every Start) */
export const ruleStart: Rule = (nodes) => {
  const s = starts(nodes)
  if (s.length === 0) return [{ rule: 'no-start', node: null, message: 'the flow has no Start' }]
  if (s.length > 1) return s.map((n) => ({ rule: 'two-starts', node: n.id, message: `${s.length} Starts — a flow has exactly one` }))
  return []
}

/** at least one End (several are fine: e.g. a good and a reject ending) */
export const ruleEnd: Rule = (nodes) =>
  nodes.some((n) => n.type === 'end') ? [] : [{ rule: 'no-end', node: null, message: 'the flow has no End' }]

/** every way out is linked — a Decision's yes and no each on their own */
export const ruleOpenLinks: Rule = (nodes, edges) =>
  nodes.flatMap((n) =>
    outlets(n.type)
      .filter((h) => !edges.some((e) => e.source === n.id && (e.sourceHandle ?? null) === h))
      .map((h) => ({ rule: 'open-link' as const, node: n.id, message: h ? `'${h}' way out is not linked` : 'way out is not linked' }))
  )

/** every node can be reached by following links from a Start (with no Start, the 'no Start' problem says it all) */
export const ruleReachable: Rule = (nodes, edges) => {
  const s = starts(nodes)
  if (s.length === 0) return []
  const seen = new Set(s.map((n) => n.id))
  const todo = [...seen]
  while (todo.length) {
    const id = todo.pop()!
    for (const e of edges) {
      if (e.source !== id || seen.has(e.target)) continue
      seen.add(e.target)
      todo.push(e.target)
    }
  }
  return nodes.filter((n) => !seen.has(n.id)).map((n) => ({ rule: 'unreachable', node: n.id, message: 'cannot be reached from Start' }))
}

/** tags used by the nodes exist in the open project and are still of the right kind (a tag may change in N03) */
export const ruleTags: Rule = (nodes, _edges, tags) => {
  if (!tags) return []
  const out: FlowIssue[] = []
  for (const n of nodes) {
    if (!n.data.p || n.type === 'start' || n.type === 'end') continue
    const type = n.type as StepKind
    const p = n.data.p as StepParams[StepKind]
    if (type === 'if') {
      const r = parseCondition((p as StepParams['if']).expr)
      if (r.ok)
        for (const name of r.names)
          if (!tags.some((t) => t.name === name)) out.push({ rule: 'unknown-tag', node: n.id, message: `no tag ${name} in the project` })
      continue
    }
    for (const f of FIELDS[type]) {
      const v = (p as Record<string, unknown>)[f.key]
      if (f.kind !== 'tag' || typeof v !== 'string' || !v) continue
      if (!tags.some((t) => t.name === v)) out.push({ rule: 'unknown-tag', node: n.id, message: `no tag ${v} in the project` })
      else if (!tagsFor(type, f, tags, p).some((t) => t.name === v))
        out.push({ rule: 'unknown-tag', node: n.id, message: `${v} is not one of the ${f.offers}` })
    }
  }
  return out
}

/**
 * a Decision's condition is well formed and — with an open project — of the right types (step 30); an empty one
 * is 'open' (dashed, not listed); unknown tag names are ruleTags' problem, not listed twice
 */
export const ruleConditions: Rule = (nodes, _edges, tags) =>
  nodes.flatMap((n) => {
    if (n.type !== 'if') return []
    const expr = (n.data.p as StepParams['if']).expr
    if (!expr.trim()) return []
    const syntax = parseCondition(expr)
    if (!syntax.ok) return [{ rule: 'bad-condition' as const, node: n.id, message: `condition: ${syntax.error}` }]
    if (!tags || syntax.names.some((name) => !tags.some((t) => t.name === name))) return []
    const typed = compileExpr(expr, tags, 'BOOL')
    return typed.ok ? [] : [{ rule: 'bad-condition' as const, node: n.id, message: `condition: ${typed.error}` }]
  })

export const RULES: Rule[] = [ruleStart, ruleEnd, ruleOpenLinks, ruleReachable, ruleTags, ruleConditions]

/** all problems of a flow, in rule order; tags = the open project's (undefined: tags are not checked) */
export function checkFlow(nodes: FlowNode[], edges: Edge[], tags?: Tag[]): FlowIssue[] {
  return RULES.flatMap((r) => r(nodes, edges, tags))
}

/** problems per node, for the badges */
export function byNode(issues: FlowIssue[]): Map<string, FlowIssue[]> {
  const m = new Map<string, FlowIssue[]>()
  for (const i of issues) if (i.node) m.set(i.node, [...(m.get(i.node) ?? []), i])
  return m
}
