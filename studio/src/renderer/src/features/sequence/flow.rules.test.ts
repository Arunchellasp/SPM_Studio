import type { Edge } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { Tag, TagFile } from '@shared/ipc'
import demo from '../../../../../../projects/demo/tags.json'
import { edgeId, makeStep, newFlow, type FlowNode, type StepParams } from './flow'
import { byNode, checkFlow, ruleConditions, ruleEnd, ruleOpenLinks, ruleReachable, ruleStart, ruleTags } from './flow.rules'

const tags = (demo as TagFile).tags as Tag[]
const e = (source: string, target: string, sourceHandle: string | null = null): Edge => ({
  id: edgeId({ source, target, sourceHandle }),
  source,
  target,
  sourceHandle
})
const step = (id: string, type: FlowNode['type'], p?: object): FlowNode => {
  const n = makeStep(type as 'delay', [])
  return { ...n, id, data: { ...n.data, ...(p ? { p: { ...(n.data.p as object), ...p } as StepParams['delay'] } : {}) } }
}
const base = newFlow().nodes

describe('N02 flow rules (step 26) — each rule on its own', () => {
  it('U-26.3 Start: exactly one — none is a flow problem, two put a badge on each', () => {
    expect(ruleStart(base, [], tags)).toEqual([])
    expect(
      ruleStart(
        base.filter((n) => n.type !== 'start'),
        [],
        tags
      )
    ).toEqual([{ rule: 'no-start', node: null, message: 'the flow has no Start' }])
    const two = [...base, step('n1', 'start')]
    expect(ruleStart(two, [], tags).map((i) => [i.rule, i.node, i.message])).toEqual([
      ['two-starts', 'start', '2 Starts — a flow has exactly one'],
      ['two-starts', 'n1', '2 Starts — a flow has exactly one']
    ])
  })

  it('U-26.4 End: at least one; two Ends are fine', () => {
    expect(ruleEnd(base, [], tags)).toEqual([])
    expect(ruleEnd([...base, step('n1', 'end')], [], tags)).toEqual([])
    expect(
      ruleEnd(
        base.filter((n) => n.type !== 'end'),
        [],
        tags
      )
    ).toEqual([{ rule: 'no-end', node: null, message: 'the flow has no End' }])
  })

  it('U-26.5 open links: every way out, a Decision yes and no each; End has none', () => {
    const n = [...base, step('n1', 'if'), step('n2', 'delay')]
    const r = (edges: Edge[]) => ruleOpenLinks(n, edges, tags).map((i) => `${i.node}: ${i.message}`)
    expect(r([])).toEqual([
      'start: way out is not linked',
      "n1: 'yes' way out is not linked",
      "n1: 'no' way out is not linked",
      'n2: way out is not linked'
    ])
    expect(r([e('start', 'n1'), e('n1', 'n2', 'yes'), e('n2', 'end')])).toEqual(["n1: 'no' way out is not linked"])
    expect(r([e('start', 'n1'), e('n1', 'n2', 'yes'), e('n1', 'end', 'no'), e('n2', 'end')])).toEqual([])
  })

  it('U-26.6 reachable: every node on a path from Start (loops back are fine)', () => {
    const n = [...base, step('n1', 'delay'), step('n2', 'delay'), step('n3', 'if')]
    const edges = [e('start', 'n3'), e('n3', 'n1', 'yes'), e('n3', 'end', 'no'), e('n1', 'n3'), e('n2', 'end')]
    expect(ruleReachable(n, edges, tags).map((i) => [i.node, i.message])).toEqual([['n2', 'cannot be reached from Start']])
    expect(
      ruleReachable(
        n.filter((x) => x.type !== 'start'),
        [],
        tags
      )
    ).toEqual([]) // 'no Start' says it already
  })

  it('U-26.7 tags: unknown names, wrong kinds (e.g. changed in N03) and unknown names in a condition; not checked without a project', () => {
    const n = [
      ...base,
      step('n1', 'wait_di', { tag: 'DI_Gone' }),
      step('n2', 'set_do', { tag: 'DI_S1_PartPresent' }),
      step('n3', 'if', { expr: 'R_PartCount >= 100 AND DI_Nowhere' }),
      step('n4', 'wait_di', { tag: 'DI_S1_PartPresent', alarm: '' })
    ]
    expect(ruleTags(n, [], tags).map((i) => `${i.node}: ${i.message}`)).toEqual([
      'n1: no tag DI_Gone in the project',
      'n2: DI_S1_PartPresent is not one of the digital outputs (DO)',
      'n3: no tag DI_Nowhere in the project'
    ])
    expect(ruleTags(n, [], undefined)).toEqual([])
  })

  it('U-26.8 conditions: a bad one is listed with the parser message; an empty one is open (dashed), not listed', () => {
    const n = [...base, step('n1', 'if', { expr: 'A >' }), step('n2', 'if', { expr: '' }), step('n3', 'if', { expr: 'A > 1' })]
    expect(ruleConditions(n, [], tags)).toEqual([
      { rule: 'bad-condition', node: 'n1', message: 'condition: Expected expression after > (position 4)' }
    ])
  })

  it('U-26.9 checkFlow: a good flow has no problems; byNode groups the badges', () => {
    const n = [...base, step('n1', 'if', { expr: 'R_PartCount >= 100' }), step('n2', 'delay')]
    const good = [e('start', 'n2'), e('n2', 'n1'), e('n1', 'end', 'yes'), e('n1', 'n2', 'no')]
    expect(checkFlow(n, good, tags)).toEqual([])
    const bad = checkFlow([...n, step('n9', 'start')], good.slice(0, 2), tags)
    const m = byNode(bad)
    expect([...m.keys()].sort()).toEqual(['end', 'n1', 'n9', 'start']) // End: no link reaches it any more
    expect(m.get('n1')!.map((i) => i.message)).toEqual(["'yes' way out is not linked", "'no' way out is not linked"])
  })

  it('U-30.5 conditions with the project open: a type error is a badge on its node; unknown tags are not listed twice; no project → syntax only', () => {
    const n = [
      ...base,
      step('n1', 'if', { expr: 'R_PartCount AND DI_S1_PartPresent' }),
      step('n2', 'if', { expr: 'R_PartCount >= 100' }),
      step('n3', 'if', { expr: 'R_Gone > 1' })
    ]
    expect(ruleConditions(n, [], tags)).toEqual([
      {
        rule: 'bad-condition',
        node: 'n1',
        message: 'condition: AND needs TRUE / FALSE on both sides — R_PartCount is a number, DI_S1_PartPresent is TRUE / FALSE'
      }
    ])
    expect(ruleConditions(n, [], undefined)).toEqual([])
    expect(ruleTags(n, [], tags).map((i) => i.message)).toEqual(['no tag R_Gone in the project'])
  })
})
