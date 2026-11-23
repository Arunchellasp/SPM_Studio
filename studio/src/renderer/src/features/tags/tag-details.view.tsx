import type { ProjectInfo, Tag } from '@shared/ipc'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Table, type Column } from '../../components/table.view'
import type { GridRow } from './tag-grid'
import { canEdit } from './tag-edit'
import { detailRows, kindRows, type KindRow } from './tags'

const KIND_COLUMNS: Column<KindRow>[] = [
  { key: 'kind', header: 'Kind', width: 90 },
  { key: 'label', header: 'Meaning', width: 190, align: 'left' },
  { key: 'count', header: 'Tags', width: 70 }
]

/**
 * Right panel of N03. A selected tag → 'Tag details · NAME' (read only; 'Change address…' opens the picker
 * — the keyboard way to it, next to double-click on the Address cell; step 19).
 * Nothing selected → the tag count per kind of the open project (step 16).
 */
export function TagDetails({
  project,
  tag,
  row,
  onPickAddress
}: {
  project: ProjectInfo
  tag: Tag | null
  row: GridRow | null
  onPickAddress: (name: string) => void
}): React.JSX.Element {
  if (!tag || !row) {
    return (
      <Card title="Tags by kind" className="tgs-details">
        <Table label="Tags by kind" columns={KIND_COLUMNS} rows={kindRows(project)} rowKey={(r) => r.kind} striped fill />
        <p className="tgs-note">Click a row to see its details.</p>
      </Card>
    )
  }
  return (
    <Card
      title={`Tag details · ${tag.name}`}
      className="tgs-details"
      aria-label="Tag details"
      actions={
        canEdit(tag, 'address') ? (
          <Button size="sm" variant="quiet" onClick={() => onPickAddress(tag.name)}>
            Change address…
          </Button>
        ) : undefined
      }
    >
      <dl className="tgs-detail-list">
        {detailRows(tag, row).map((d) => (
          <div key={d.label} className="tgs-detail">
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
