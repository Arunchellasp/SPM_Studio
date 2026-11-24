import { Button } from '../../components/button.view'
import { Icon } from '../../components/icon.view'
import { useProject } from '../../stores/project.store'
import { useSequence } from '../../stores/sequence.store'
import { stationsOf } from './program'
import { useProgramDirty } from './program-dirty'

/**
 * N02 › Project › Sequences (step 27): the stations of the project and their flows — the design's tree
 * ('stations → flows → sub-flows', Software implementation › 4b.1; sub-flows come with their node type).
 * A click shows that flow on the canvas; '+ New flow' adds one to the station. Save writes all flows to
 * program.json of the project open in Tags.
 */
export function FlowTree(): React.JSX.Element {
  const flows = useSequence((s) => s.flows)
  const active = useSequence((s) => s.active)
  const selectFlow = useSequence((s) => s.selectFlow)
  const addFlow = useSequence((s) => s.addFlow)
  const project = useProject((s) => s.project)
  const busy = useProject((s) => s.busy)
  const saveProgram = useProject((s) => s.saveProgram)
  const dirty = useProgramDirty() && !!project
  const stations = stationsOf(project?.tags.tags, flows)

  return (
    <div className="seq-flows">
      <ul className="seq-tree-list" aria-label="Flows by station">
        {stations.map((st) => (
          <li key={st}>
            <span className="seq-station">
              <Icon name="program" /> {st}
            </span>
            <ul aria-label={`Flows of ${st}`}>
              {flows.map((f, i) =>
                f.station !== st ? null : (
                  <li key={f.name}>
                    <button type="button" className="seq-flow" aria-current={i === active ? 'true' : undefined} onClick={() => selectFlow(i)}>
                      {f.name}
                    </button>
                  </li>
                )
              )}
              <li>
                <button type="button" className="seq-flow seq-flow-new" aria-label={`New flow in ${st}`} onClick={() => addFlow(st)}>
                  + New flow
                </button>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <div className="seq-save">
        <Button
          size="md"
          variant={dirty ? 'primary' : 'default'}
          icon={<Icon name="save" />}
          onClick={() => void saveProgram()}
          disabled={busy || !project}
          title={project ? `Save all flows to ${project.name}/program.json (Ctrl+S)` : 'Open a project in Tags first'}
        >
          Save
        </Button>
        {dirty && (
          <span className="seq-dirty" data-testid="program-dirty">
            ● unsaved changes
          </span>
        )}
        {!project && <span className="seq-later">Open a project in Tags to save the flows.</span>}
      </div>
    </div>
  )
}
