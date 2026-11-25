import { useEffect } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useScreenScale } from '../../app/screen-scale'
import { useSequence } from '../../stores/sequence.store'
import { DecisionNode } from './decision-node.view'
import { connectProblem, GRID, STEP_DEFS, TERMINAL_DEFS, type FlowNode, type StepKind, type Terminal } from './flow'
import { useFlowIssues } from './flow-issues'
import { IssuesContext } from './issue-badge.view'
import { DND_TYPE } from './palette.view'
import { StepNode } from './step-node.view'
import { TerminalNode } from './terminal-node.view'
import './canvas.css'

const NODE_TYPES = {
  start: TerminalNode,
  end: TerminalNode,
  move_abs: StepNode,
  wait_di: StepNode,
  set_do: StepNode,
  delay: StepNode,
  if: DecisionNode
}
const STEP_TYPES = new Set<string>([...TERMINAL_DEFS, ...STEP_DEFS].map((d) => d.type))
/** fit = all nodes in view with a margin, never bigger than 100 % (the fit button has its own options — step 24) */
/** flow units; a node is 44 … 54 high, so anywhere on its upper half reaches the dot on top */
export const LINK_RADIUS = 40

const FIT = { padding: 1 / 5, maxZoom: 1 }

/**
 * The N02 canvas (step 23): React Flow. Drag the background to pan, wheel to zoom, +/−/fit bottom left,
 * mini-map bottom right, drag from a node's dot to another node to link them.
 * Look: React Flow's --xy-* variables are set from the app tokens (canvas.css) — light and dark from one place.
 */
export function SequenceCanvas(): React.JSX.Element {
  // useReactFlow (drop point → flow coordinates) needs the provider around the canvas
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}

function Canvas(): React.JSX.Element {
  const flow = useReactFlow()
  const addStep = useSequence((s) => s.addStep)
  const nodes = useSequence((s) => s.nodes)
  const edges = useSequence((s) => s.edges)
  const onNodesChange = useSequence((s) => s.onNodesChange)
  const onEdgesChange = useSequence((s) => s.onEdgesChange)
  const connect = useSequence((s) => s.connect)
  const record = useSequence((s) => s.record)
  const dropIfUnmoved = useSequence((s) => s.dropIfUnmoved)
  const fitTick = useSequence((s) => s.fitTick)
  // step 28: after Tidy up, show the whole tidied flow (once the new positions are drawn)
  useEffect(() => {
    if (!fitTick) return
    const t = requestAnimationFrame(() => void flow.fitView(FIT))
    return () => cancelAnimationFrame(t)
  }, [fitTick, flow])
  // The shell is CSS-zoomed on small screens / Windows 125 % (step 9). React Flow reads the pointer in page
  // pixels but draws in the zoomed space, so links and drops landed off (found on the PC, P-23.3). The canvas
  // undoes the shell zoom for itself: inside it a CSS pixel is a page pixel again.
  const { zoom } = useScreenScale()
  const { perNode } = useFlowIssues()

  return (
    <div
      className="seq-canvas"
      data-testid="seq-canvas"
      style={zoom === 1 ? undefined : { zoom: 1 / zoom }}
      // step 24: drop from the palette — the node's top-left corner where the pointer is, centred on it
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DND_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DND_TYPE)
        if (!STEP_TYPES.has(type)) return
        e.preventDefault()
        const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        addStep(type as StepKind | Terminal, { x: p.x - GRID * 8, y: p.y - GRID * 2 })
      }}
    >
      <IssuesContext.Provider value={perNode}>
        <ReactFlow<FlowNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(c: Connection) => void connect(c)}
          // a link let go anywhere on a node connects to it — no need to hit its 10 px dot (found on the PC,
          // physical test P-26.2: the middle of an 80 px Decision is beyond the 40 px catch radius)
          onConnectEnd={(event, state) => {
            // React Flow made the link itself when it found a fitting dot (isValid). Otherwise — no dot near, or the
            // nearest dot was an exit (a Decision's own 'yes' dot is closest to its lower half) — the node under the
            // pointer is the target; connect() checks the rules and says why when it refuses (e.g. into Start)
            if (state.isValid || !state.fromNode || state.fromHandle?.type !== 'source') return
            const p = 'changedTouches' in event ? event.changedTouches[0] : event
            if (!p) return
            const under = document.elementFromPoint(p.clientX, p.clientY)?.closest('.react-flow__node')
            const target = under?.getAttribute('data-id')
            if (!target || target === state.fromNode.id) return
            connect({ source: state.fromNode.id, sourceHandle: state.fromHandle.id ?? null, target, targetHandle: null })
          }}
          // step 28: undo steps for what React Flow changes by itself — a drag (from where it started) and Delete
          onNodeDragStart={() => record()}
          onNodeDragStop={() => dropIfUnmoved()}
          onBeforeDelete={async () => {
            record()
            return true
          }}
          // while dragging a link: green / red handle, the same rule as on drop
          isValidConnection={(c) => connectProblem(c, nodes, edges) === ''}
          // a link ends on the nearest free dot within this distance, so letting go on the box itself works
          // (found on the PC, physical test P-23.3: the 10 px dot was too hard to hit by hand)
          connectionRadius={LINK_RADIUS}
          snapToGrid
          snapGrid={[GRID, GRID]}
          fitView
          fitViewOptions={FIT}
          minZoom={1 / 4}
          maxZoom={2}
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
          aria-label="Sequence canvas"
        >
          <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} />
          <Controls showInteractive={false} position="bottom-left" fitViewOptions={FIT} />
          <MiniMap position="bottom-right" pannable zoomable ariaLabel="Mini-map" />
        </ReactFlow>
      </IssuesContext.Provider>
    </div>
  )
}
