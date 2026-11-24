import type { ScreenDef } from '../../app/screens'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Icon } from '../../components/icon.view'
import { Tabs } from '../../components/tabs.view'
import { useSequence } from '../../stores/sequence.store'
import { BuildOutput } from './build-output.view'
import { SequenceCanvas } from './canvas.view'
import { useFlowIssues } from './flow-issues'
import { FlowTree } from './flow-tree.view'
import { NodePalette } from './palette.view'
import { PropertyPanel } from './property-panel.view'
import './sequence-screen.css'

/** the canvas toolbar of the design — all need the runtime (phase G) */
const RUN_TOOLS = ['Run', 'Pause', 'Step', 'Breakpoint', 'Force', 'Online change']

const later = (what: string, step: string): React.JSX.Element => (
  <p className="seq-later">
    {what} — {step}.
  </p>
)

/**
 * N02 Program › Sequence editor (Improved design › N02), step 23: the layout of the design —
 * project tree · canvas · properties, and the Watch / Trace / Cross reference / Build output panel below.
 * Working now: the canvas (Start, End, link, pan, zoom, mini-map). The other areas say which step fills them.
 */
export function SequenceScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const edges = useSequence((s) => s.edges)
  const nodes = useSequence((s) => s.nodes)
  const reset = useSequence((s) => s.reset)
  const { issues } = useFlowIssues()
  return (
    <div className="seq">
      {/* no visible title in the design, but every screen keeps its heading for screen readers (and UI-13.5) */}
      <h1 className="sr-only">
        {screen.code} {screen.title}
      </h1>
      <Card title="Project" className="seq-tree">
        <h2 className="seq-sub">Nodes</h2>
        <NodePalette />
        <h2 className="seq-sub">Sequences</h2>
        <FlowTree />
      </Card>

      {/* the design has no title here: the toolbar is the first row of the canvas card */}
      <Card className="seq-main" padding="none" aria-label="Sequence">
        <div className="seq-tools" role="toolbar" aria-label="Sequence tools">
          {RUN_TOOLS.map((t) => (
            <Button key={t} size="md" disabled title="needs the runtime (phase G)">
              {t}
            </Button>
          ))}
          <span className="seq-status" data-testid="seq-status" title={`Offline · ${nodes.length} nodes · ${edges.length} links`}>
            Offline · {nodes.length} nodes · {edges.length} {edges.length === 1 ? 'link' : 'links'}
          </span>
          {/* step 26: the flow's problems at a glance — details in Build output and on the badges */}
          <span className={issues.length ? 'seq-problems seq-problems-bad' : 'seq-problems'} data-testid="seq-problems">
            {issues.length ? `⚠ ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}` : '✓ no problems'}
          </span>
          <Button
            size="md"
            variant="quiet"
            icon={<Icon name="reset" />}
            aria-label="Clear flow"
            title="Clear this flow: back to Start and End only (+ New flow in the tree adds a flow)"
            onClick={reset}
          />
        </div>
        <SequenceCanvas />
      </Card>

      <Card title="Properties" className="seq-props">
        <PropertyPanel />
      </Card>

      <Card className="seq-bottom">
        <Tabs
          label="Program tools"
          tabs={[
            { id: 'watch', label: 'Watch', content: later('Live values of chosen tags', 'phase G (runtime link)') },
            { id: 'trace', label: 'Trace', content: later('Step changes over time', 'phase G (runtime link)') },
            { id: 'xref', label: 'Cross reference', content: later('Where each tag is used', 'step 27') },
            { id: 'build', label: 'Build output', content: <BuildOutput /> }
          ]}
        />
      </Card>
    </div>
  )
}
