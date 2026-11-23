import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Connection, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSequence } from '../../stores/sequence.store'
import { connectProblem, GRID, STEP_DEFS, type FlowNode, type StepKind } from './flow'
import { DND_TYPE } from './palette.view'
import { StepNode } from './step-node.view'
import { TerminalNode } from './terminal-node.view'
import './canvas.css'

const NODE_TYPES = { start: TerminalNode, end: TerminalNode, move_abs: StepNode, wait_di: StepNode, set_do: StepNode, delay: StepNode }
const STEP_TYPES = new Set<string>(STEP_DEFS.map((d) => d.type))
/** fit = all nodes in view with a margin, never bigger than 100 % (the fit button has its own options — step 24) */
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

  return (
    <div
      className="seq-canvas"
      data-testid="seq-canvas"
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
        addStep(type as StepKind, { x: p.x - GRID * 8, y: p.y - GRID * 2 })
      }}
    >
      <ReactFlow<FlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c: Connection) => void connect(c)}
        // while dragging a link: green / red handle, the same rule as on drop
        isValidConnection={(c) => connectProblem(c, nodes, edges) === ''}
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
    </div>
  )
}
