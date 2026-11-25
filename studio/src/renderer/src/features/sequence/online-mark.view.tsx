import { createContext, useContext, useMemo } from 'react'
import { useLive } from '../../stores/live.store'
import { useOnline } from '../../stores/online.store'
import { useProject } from '../../stores/project.store'
import { useSequence } from '../../stores/sequence.store'
import { onlineView, type OnlineView } from './online'
import { useProgramDirty } from './program-dirty'

const OFF: OnlineView = { kind: 'offline', text: '', title: '', active: null, live: {} }
/** the live step and the values, from the canvas to its nodes (step 34; like IssuesContext of step 26) */
export const OnlineContext = createContext<OnlineView>(OFF)

/** everything N02 needs to show the running program — recomputed only when what it shows changes */
export function useOnlineView(): OnlineView {
  const link = useLive((s) => s.status.link)
  const prog = useLive((s) => s.machine?.prog)
  const pc = useLive((s) => s.state.pc)
  const values = useLive((s) => s.state.values)
  const rt = useOnline((s) => s.rt)
  const tags = useProject((s) => s.project?.tags.tags)
  const nodes = useSequence((s) => s.nodes)
  const links = useSequence((s) => s.edges.length)
  const flowName = useSequence((s) => s.flows[s.active]?.name ?? '')
  const dirty = useProgramDirty()
  const v = onlineView({ link, prog, rt, flowName, pc, values, tags: tags ?? [], nodes, links, dirty })
  // state frames come 20 times a second: keep the same object while nothing visible changed (no re-render of every node)
  const key = JSON.stringify(v)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => v, [key])
}

/**
 * On a node (step 34): a green glow around the live step, and the values of its tags under it.
 * Nothing when offline or when the runtime runs another program.
 */
export function OnlineMark({ node }: { node: string }): React.JSX.Element | null {
  const v = useContext(OnlineContext)
  const live = v.live[node]
  const active = v.active === node
  if (!active && !live) return null
  return (
    <>
      {active && <span className="seq-live-ring" data-testid="live-step" aria-label="live step" />}
      {live && (
        <span className={active ? 'seq-live-val seq-live-val-on' : 'seq-live-val'} data-testid={`live-${node}`}>
          {live}
        </span>
      )}
    </>
  )
}
