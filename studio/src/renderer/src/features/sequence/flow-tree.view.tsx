import { Button } from '../../components/button.view'
import { Icon } from '../../components/icon.view'
import { useProject } from '../../stores/project.store'
import { useSequence } from '../../stores/sequence.store'
import { stationsOf } from './program'
import { useProgramDirty } from './program-dirty'
import { useOnline } from '../../stores/online.store'
import { useLive } from '../../stores/live.store'
import { useUi } from '../../stores/ui.store'
import { may } from '@shared/roles'

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
  const dl = useDownloadView()
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
                    <button
                      type="button"
                      className="seq-flow"
                      aria-current={i === active ? 'true' : undefined}
                      onClick={() => selectFlow(i)}
                    >
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
      {/* step 34: Download (Software implementation › 6 / 7c) — the saved program to the runtime, only in STOPPED */}
      <div className="seq-download">
        <Button
          size="md"
          icon={<Icon name="download" />}
          disabled={!dl.enabled}
          title={dl.why}
          onClick={() => void useOnline.getState().download()}
        >
          Download
        </Button>
      </div>
    </div>
  )
}

/** step 34: may the program be downloaded now, and if not, why (the button's tooltip) */
export function useDownloadView(): { enabled: boolean; why: string } {
  const link = useLive((s) => s.status.link)
  const state = useUi((s) => s.machineState)
  const role = useUi((s) => s.userRole)
  const open = useProject((s) => !!s.project)
  const busy = useOnline((s) => s.busy)
  const dirty = useProgramDirty()
  if (!open) return { enabled: false, why: 'Open a project first (Tags › Open project…)' }
  if (dirty) return { enabled: false, why: 'Save first (Ctrl+S): the runtime gets the saved program.json' }
  if (link !== 'online') return { enabled: false, why: 'Runtime OFFLINE — no download' }
  if (!may(role, 'download')) return { enabled: false, why: `Your role (${role}) may not download programs` }
  if (state !== 'STOPPED') return { enabled: false, why: `Download only in STOPPED (now ${state}) — press Stop first` }
  if (busy) return { enabled: false, why: 'Compiling …' }
  return { enabled: true, why: 'Compile the saved program and send it to the runtime (program.rt.json + CRC)' }
}
