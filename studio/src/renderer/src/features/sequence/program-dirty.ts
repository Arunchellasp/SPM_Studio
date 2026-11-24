import { useMemo } from 'react'
import { useSequence } from '../../stores/sequence.store'
import { programText } from './program'

/** step 27: does the drawing differ from program.json on disk? (compared as the text Save would write) */
export function useProgramDirty(): boolean {
  const nodes = useSequence((s) => s.nodes)
  const edges = useSequence((s) => s.edges)
  const flows = useSequence((s) => s.flows)
  const active = useSequence((s) => s.active)
  const saved = useSequence((s) => s.saved)
  return useMemo(() => programText(flows.map((f, i) => (i === active ? { ...f, nodes, edges } : f))) !== saved, [nodes, edges, flows, active, saved])
}

/** the same, outside React (project store: 'discard unsaved changes?') */
export const programDirty = (): boolean => programText(useSequence.getState().currentFlows()) !== useSequence.getState().saved
