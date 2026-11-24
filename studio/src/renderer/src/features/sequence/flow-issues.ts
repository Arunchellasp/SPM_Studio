import { useMemo } from 'react'
import { useProject } from '../../stores/project.store'
import { useSequence } from '../../stores/sequence.store'
import { byNode, checkFlow, type FlowIssue } from './flow.rules'

/**
 * The flow's problems, checked again on every change of nodes, links or the open project's tags (step 26).
 * Without an open project the tags are not checked — `tagsChecked` says so in the status line.
 */
export function useFlowIssues(): { issues: FlowIssue[]; perNode: Map<string, FlowIssue[]>; tagsChecked: boolean } {
  const nodes = useSequence((s) => s.nodes)
  const edges = useSequence((s) => s.edges)
  const tags = useProject((s) => s.project?.tags.tags)
  return useMemo(() => {
    const issues = checkFlow(nodes, edges, tags)
    return { issues, perNode: byNode(issues), tagsChecked: !!tags }
  }, [nodes, edges, tags])
}
