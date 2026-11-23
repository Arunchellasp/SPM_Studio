import type { ScreenDef } from '../../app/screens'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Icon } from '../../components/icon.view'
import { Table, type Column } from '../../components/table.view'
import { useProject } from '../../stores/project.store'
import { kindRows, tagCountText, type KindRow } from './tags'
import './tags-screen.css'

const KIND_COLUMNS: Column<KindRow>[] = [
  { key: 'kind', header: 'Kind', width: 120 },
  { key: 'label', header: 'Meaning', width: 260, align: 'left' },
  { key: 'count', header: 'Tags', width: 100 }
]

/**
 * N03 Tags. Step 16: which project is open (File › Open project…, Ctrl+O) and what its tags.json holds.
 * The tag table of the design (search, filters, + New tag, details) is built in phase D.
 */
export function TagsScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const project = useProject((s) => s.project)
  const busy = useProject((s) => s.busy)
  const open = useProject((s) => s.open)
  const save = useProject((s) => s.save)

  return (
    <div className="tgs">
      <div className="tgs-head">
        <h1>
          <span className="tgs-code">{screen.code}</span> {screen.title}
        </h1>
        <p className="tgs-purpose">{screen.purpose}</p>
      </div>

      <Card
        title="Project"
        className="tgs-project"
        actions={
          <>
            <Button size="md" icon={<Icon name="open" />} onClick={() => void open()} disabled={busy}>
              Open project…
            </Button>
            <Button size="md" icon={<Icon name="save" />} onClick={() => void save()} disabled={busy || !project}>
              Save
            </Button>
          </>
        }
      >
        {project ? (
          <dl className="tgs-facts" aria-label="Open project">
            <dt>Name</dt>
            <dd data-testid="project-name">{project.name}</dd>
            <dt>Folder</dt>
            <dd className="tgs-path">{project.dir}</dd>
            <dt>tags.json</dt>
            <dd data-testid="project-count">
              {tagCountText(project.tags.tags.length)} · format {project.tags.schema}
            </dd>
          </dl>
        ) : (
          <p className="tgs-note" data-testid="project-none">
            No project open. Open a project folder (the folder that holds tags.json) with Open project…, or File › Open project… (Ctrl+O).
          </p>
        )}
      </Card>

      {project && (
        <Card title="Tags by kind" className="tgs-kinds">
          <Table label="Tags by kind" columns={KIND_COLUMNS} rows={kindRows(project)} rowKey={(r) => r.kind} striped />
          <p className="tgs-note">The full tag table (search, filters, + New tag, details) comes in phase D.</p>
        </Card>
      )}
    </div>
  )
}
