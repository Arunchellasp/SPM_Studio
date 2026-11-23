import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type Connection, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSequence } from '../../stores/sequence.store'
import { connectProblem, GRID, type FlowNode } from './flow'
import { TerminalNode } from './terminal-node.view'
import './canvas.css'

const NODE_TYPES = { start: TerminalNode, end: TerminalNode }

/**
 * The N02 canvas (step 23): React Flow. Drag the background to pan, wheel to zoom, +/−/fit bottom left,
 * mini-map bottom right, drag from a node's dot to another node to link them.
 * Look: React Flow's --xy-* variables are set from the app tokens (canvas.css) — light and dark from one place.
 */
export function SequenceCanvas(): React.JSX.Element {
  const nodes = useSequence((s) => s.nodes)
  const edges = useSequence((s) => s.edges)
  const onNodesChange = useSequence((s) => s.onNodesChange)
  const onEdgesChange = useSequence((s) => s.onEdgesChange)
  const connect = useSequence((s) => s.connect)

  return (
    <div className="seq-canvas" data-testid="seq-canvas">
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
        fitViewOptions={{ padding: 1 / 2, maxZoom: 1 }}
        minZoom={1 / 4}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        aria-label="Sequence canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap position="bottom-right" pannable zoomable ariaLabel="Mini-map" />
      </ReactFlow>
    </div>
  )
}
