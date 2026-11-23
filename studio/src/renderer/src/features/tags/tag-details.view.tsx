import type { ProjectInfo, Tag, TagKind } from '@shared/ipc'
import { KIND_RULES, type TagIssue } from '@shared/tags-rules'
import { Button } from '../../components/button.view'
import { Icon } from '../../components/icon.view'
import { Card } from '../../components/card.view'
import { Select } from '../../components/select.view'
import { Table, type Column } from '../../components/table.view'
import { confirmDialog } from '../../stores/feedback.store'
import type { GridRow } from './tag-grid'
import { canEdit, changeKind } from './tag-edit'
import { detailRows, KIND_LABEL, kindRows, type KindRow } from './tags'

const KIND_COLUMNS: Column<KindRow>[] = [
  { key: 'kind', header: 'Kind', width: 90 },
  { key: 'label', header: 'Meaning', width: 190, align: 'left' },
  { key: 'count', header: 'Tags', width: 70 }
]

const KIND_OPTIONS = Object.keys(KIND_RULES).map((k) => ({ value: k, label: `${k} · ${KIND_LABEL[k] ?? k}` }))

export interface TagDetailsProps {
  project: ProjectInfo
  tag: Tag | null
  row: GridRow | null
  issues: TagIssue[]
  onPickAddress: (name: string) => void
  onPickScale: (name: string) => void
  onKind: (kind: TagKind) => void
  onDuplicate: (name: string) => void
  onDelete: (name: string) => void
}

/**
 * Right panel of N03. A selected tag → 'Tag details · NAME': its problems first (step 20), Kind as a list
 * (step 20), 'Change…' for address (step 19) and scaling (step 20), the rest read only.
 * Nothing selected → the tag count per kind of the open project (step 16).
 */
export function TagDetails({ project, tag, row, issues, onPickAddress, onPickScale, onKind, onDuplicate, onDelete }: TagDetailsProps): React.JSX.Element {
  if (!tag || !row) {
    return (
      <Card title="Tags by kind" className="tgs-details">
        <Table label="Tags by kind" columns={KIND_COLUMNS} rows={kindRows(project)} rowKey={(r) => r.kind} striped fill />
        <p className="tgs-note">Click a row to see its details.</p>
      </Card>
    )
  }

  const askKind = async (kind: TagKind): Promise<void> => {
    const { dropped } = changeKind(tag, kind)
    if (dropped.length) {
      const go = await confirmDialog({
        title: `Change ${tag.name} to ${kind}?`,
        message: `A ${kind} tag does not have: ${dropped.join(', ')}. These are removed. Red cells then show what a ${kind} still needs.`,
        confirmLabel: `Change to ${kind}`,
        danger: true
      })
      if (!go) return
    }
    onKind(kind)
  }

  const action: Record<string, React.JSX.Element | undefined> = {
    Address: canEdit(tag, 'address') ? (
      <Button size="sm" variant="quiet" aria-label="Change address…" onClick={() => onPickAddress(tag.name)}>
        Change…
      </Button>
    ) : undefined,
    Scaling: canEdit(tag, 'scale') ? (
      <Button size="sm" variant="quiet" aria-label="Change scaling…" onClick={() => onPickScale(tag.name)}>
        Change…
      </Button>
    ) : undefined
  }

  return (
    <Card
      title={`Tag details · ${tag.name}`}
      className="tgs-details"
      aria-label="Tag details"
      actions={
        <>
          <Button size="sm" variant="quiet" icon={<Icon name="copy" />} aria-label="Duplicate" title="Duplicate" onClick={() => onDuplicate(tag.name)} />
          <Button size="sm" variant="quiet" icon={<Icon name="trash" />} aria-label="Delete (Del)" title="Delete (Del)" onClick={() => onDelete(tag.name)} />
        </>
      }
    >
      {issues.length > 0 && (
        <ul className="tgs-issues" aria-label="Problems">
          {issues.map((i, n) => (
            <li key={n}>⚠ {i.message}</li>
          ))}
        </ul>
      )}
      <dl className="tgs-detail-list">
        <div className="tgs-detail">
          <dt aria-hidden="true">Kind</dt>
          <dd className="tgs-dd-select">
            <Select
              label="Kind"
              className="tgs-nolabel"
              options={KIND_OPTIONS}
              value={tag.kind}
              onChange={(e) => void askKind(e.target.value as TagKind)}
              block
            />
          </dd>
        </div>
        {detailRows(tag, row)
          .filter((d) => d.label !== 'Kind')
          .map((d) => (
            <div key={d.label} className="tgs-detail">
              <dt>{d.label}</dt>
              <dd className={action[d.label] ? 'tgs-dd-action' : undefined}>
                <span>{d.value}</span>
                {action[d.label]}
              </dd>
            </div>
          ))}
      </dl>
    </Card>
  )
}
