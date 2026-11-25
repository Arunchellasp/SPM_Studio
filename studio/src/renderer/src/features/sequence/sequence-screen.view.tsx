import { useEffect } from 'react'
import type { ScreenDef } from '../../app/screens'
import { toast } from '../../stores/feedback.store'
import { autoLayout } from './auto-layout'
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
import { OnlineContext, useOnlineView } from './online-mark.view'
import './sequence-screen.css'

/** the canvas toolbar of the design — per-flow control comes with the flow engine (Start / Hold of the whole machine: header) */
const RUN_TOOLS = ['Run', 'Pause', 'Step', 'Breakpoint', 'Force', 'Online change']
const RUN_LATER =
  'Start and Hold of the machine are in the header; Run, Pause, Step and Breakpoint for one flow come with the flow engine (step 37), Force with N04 (step 38)'

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
  const reset = useSequence((s) => s.reset)
  const canUndo = useSequence((s) => s.past.length > 0)
  const canRedo = useSequence((s) => s.future.length > 0)
  const tidy = async (): Promise<void> => {
    const s = useSequence.getState()
    s.applyLayout(await autoLayout(s.nodes, s.edges))
  }
  // step 28 keys on N02 (like N03, step 21): Ctrl+Z / Ctrl+Y undo / redo, Ctrl+C / Ctrl+V copy / paste nodes.
  // Not while typing in a field and not while a dialog is open: there the keys belong to the text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.dlg-backdrop')) return
      const s = useSequence.getState()
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (!s.undo()) toast('Nothing to undo', 'info')
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        if (!s.redo()) toast('Nothing to redo', 'info')
      } else if (k === 'c') {
        const n = s.copy()
        if (n) toast(`Copied ${n} ${n === 1 ? 'node' : 'nodes'} — Ctrl+V pastes`, 'info')
      } else if (k === 'v') {
        e.preventDefault()
        if (!s.paste().length) toast('Nothing to paste — select nodes and press Ctrl+C first', 'info')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const { issues } = useFlowIssues()
  const online = useOnlineView()
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
            <Button key={t} size="md" disabled title={RUN_LATER}>
              {t}
            </Button>
          ))}
          <span className={`seq-status seq-status-${online.kind}`} data-testid="seq-status" title={online.title}>
            {online.text}
          </span>
          {/* step 26: the flow's problems at a glance — details in Build output and on the badges */}
          <span className={issues.length ? 'seq-problems seq-problems-bad' : 'seq-problems'} data-testid="seq-problems">
            {issues.length ? `⚠ ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}` : '✓ no problems'}
          </span>
          <Button
            size="md"
            variant="quiet"
            icon={<Icon name="undo" />}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            onClick={() => useSequence.getState().undo()}
            disabled={!canUndo}
          />
          <Button
            size="md"
            variant="quiet"
            icon={<Icon name="redo" />}
            aria-label="Redo (Ctrl+Y)"
            title="Redo (Ctrl+Y)"
            onClick={() => useSequence.getState().redo()}
            disabled={!canRedo}
          />
          <Button
            size="md"
            variant="quiet"
            icon={<Icon name="layout" />}
            aria-label="Tidy up"
            title="Tidy up: lay the flow out top to bottom (one undo step). Ctrl+C / Ctrl+V copy and paste nodes."
            onClick={() => void tidy()}
          />
          <Button
            size="md"
            variant="quiet"
            icon={<Icon name="reset" />}
            aria-label="Clear flow"
            title="Clear this flow: back to Start and End only (+ New flow in the tree adds a flow)"
            onClick={reset}
          />
        </div>
        <OnlineContext.Provider value={online}>
          <SequenceCanvas />
        </OnlineContext.Provider>
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
