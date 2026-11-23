import { useMemo, useState } from 'react'
import type { Tag } from '@shared/ipc'
import { planImport } from '@shared/tag-table'
import { Button } from '../../components/button.view'
import { Modal } from '../../components/modal.view'
import { Segmented } from '../../components/segmented.view'

type Mode = 'merge' | 'replace'

/**
 * Import preview (step 22): what the file would do to the tag table, before anything changes.
 * Merge = rows replace tags of the same name, new ones are added, the rest stays. Replace = the file is the table.
 * Applied as ONE change: Ctrl+Z takes the whole import back. Problems in the rows show red (rules, step 20).
 */
export function ImportDialog({
  file,
  incoming,
  errors,
  current,
  onOk,
  onClose
}: {
  file: string
  incoming: Tag[]
  errors: string[]
  current: Tag[]
  onOk: (mode: Mode) => void
  onClose: () => void
}): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('merge')
  const plan = useMemo(() => planImport(current, incoming), [current, incoming])
  const short = (names: string[]): string => (names.length > 4 ? `${names.slice(0, 4).join(', ')} … (+${names.length - 4})` : names.join(', '))
  const nothing = plan.added.length + plan.changed.length === 0 && (mode === 'merge' || plan.missing.length === 0)
  return (
    <Modal
      wide
      title="Import tags"
      onClose={onClose}
      actions={
        <>
          <Button size="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xl" variant={mode === 'replace' ? 'danger' : 'primary'} onClick={() => onOk(mode)} disabled={nothing}>
            Import
          </Button>
        </>
      }
    >
      <div className="imp">
        <p className="imp-file">
          <b>{file}</b> · {incoming.length} rows read
        </p>
        <Segmented<Mode>
          label="Import mode"
          options={[
            { value: 'merge', label: 'Merge' },
            { value: 'replace', label: 'Replace all' }
          ]}
          value={mode}
          onChange={setMode}
        />
        <dl className="imp-plan" aria-label="What the import does">
          <dt>New</dt>
          <dd data-testid="imp-new">{plan.added.length ? `${plan.added.length} · ${short(plan.added)}` : '0'}</dd>
          <dt>Changed</dt>
          <dd data-testid="imp-changed">{plan.changed.length ? `${plan.changed.length} · ${short(plan.changed)}` : '0'}</dd>
          <dt>The same</dt>
          <dd>{plan.same.length}</dd>
          <dt>Not in the file</dt>
          <dd data-testid="imp-missing">
            {plan.missing.length} {plan.missing.length ? (mode === 'merge' ? '· kept' : '· REMOVED') : ''}
          </dd>
        </dl>
        {errors.length > 0 && (
          <div className="imp-errors" role="alert">
            <b>
              {errors.length} {errors.length === 1 ? 'row' : 'rows'} could not be read (left out):
            </b>
            <ul>
              {errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 5 && <li>… and {errors.length - 5} more</li>}
            </ul>
          </div>
        )}
        <p className="imp-note">One change: Ctrl+Z takes the whole import back. Problems in the rows show red afterwards.</p>
      </div>
    </Modal>
  )
}
