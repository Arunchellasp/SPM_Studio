import { Icon } from '../../components/icon.view'
import { useSequence } from '../../stores/sequence.store'
import { STEP_DEFS, TERMINAL_DEFS } from './flow'

/** the drag data type: only drops from this palette create nodes */
export const DND_TYPE = 'application/x-spm-node'

/**
 * Node palette (Software implementation › 4b: 'drag a node type onto the canvas → creates node with default params').
 * Drag onto the canvas = at the drop point. Click / Enter = below the lowest node (the keyboard way).
 */
export function NodePalette(): React.JSX.Element {
  const addStep = useSequence((s) => s.addStep)
  return (
    <ul className="seq-palette" aria-label="Node palette">
      {[...TERMINAL_DEFS.map((d) => ({ ...d, shape: 'terminal', icon: undefined })), ...STEP_DEFS].map((d) => (
        <li key={d.type}>
          <button
            type="button"
            className="seq-pal-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DND_TYPE, d.type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => addStep(d.type)}
            title={`${d.op} — done when: ${d.done}. Drag onto the canvas, or click to add below the last node.`}
          >
            <span className={`seq-pal-shape seq-pal-${d.shape}`} aria-hidden="true">
              {d.icon && <Icon name={d.icon} />}
            </span>
            <span>{d.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
