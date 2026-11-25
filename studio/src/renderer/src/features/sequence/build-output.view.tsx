import { useSequence } from '../../stores/sequence.store'
import { stepDef, type FlowNode, type StepKind } from './flow'
import { useFlowIssues } from './flow-issues'
import { useOnline } from '../../stores/online.store'

const nodeName = (n: FlowNode | undefined): string =>
  !n ? '' : n.type === 'start' || n.type === 'end' ? n.data.label : n.data.name || stepDef(n.type as StepKind).title

/**
 * N02 › Build output (step 26): every problem of the flow, one line each; a click selects the node
 * (its form opens in Properties). The step table compiler adds its own messages here in step 29.
 */
export function BuildOutput(): React.JSX.Element {
  const { issues, tagsChecked } = useFlowIssues()
  const nodes = useSequence((s) => s.nodes)
  const selectOnly = useSequence((s) => s.selectOnly)
  const built = useOnline((s) => s.errors)
  const stage = useOnline((s) => s.stage)
  return (
    <div className="seq-build" aria-label="Build output">
      {/* step 34: what the compiler (whole program) or the runtime said on the last Build / Download */}
      {built.length > 0 && (
        <>
          <p className="seq-build-head seq-build-bad" data-testid="build-compile">
            ⚠ {stage === 'download' ? 'Download refused' : stage === 'compile' ? 'The program does not compile' : 'Not built'}
          </p>
          <ul className="seq-build-list">
            {built.map((e) => (
              <li key={e} className="seq-build-item">
                {e}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={issues.length ? 'seq-build-head seq-build-bad' : 'seq-build-head'} data-testid="build-head">
        {issues.length ? `⚠ ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} in the flow` : '✓ No problems in the flow'}
        {!tagsChecked && ' · tags not checked (no project open)'}
      </p>
      {issues.length > 0 && (
        <ul className="seq-build-list">
          {issues.map((i, k) => {
            const n = nodes.find((x) => x.id === i.node)
            return (
              <li key={`${i.rule}-${i.node}-${k}`}>
                {n ? (
                  <button type="button" className="seq-build-item" onClick={() => selectOnly(n.id)} title="Select this node">
                    <b>{nodeName(n)}</b> ({n.id}) — {i.message}
                  </button>
                ) : (
                  <span className="seq-build-item">
                    <b>Flow</b> — {i.message}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
