import { useState } from 'react'
import type { Tag, TagKind } from '@shared/ipc'
import { Button } from '../../components/button.view'
import { Field } from '../../components/field.view'
import { Modal } from '../../components/modal.view'
import { Select } from '../../components/select.view'
import { NEW_KINDS, newTag } from './tag-edit'
import { KIND_LABEL } from './tags'

/**
 * '+ New tag' (step 21): kind + name. An empty name takes the suggestion (DI_New_1 …).
 * The new tag gets defaults that pass the rules: I/O on a free channel of the simulated card, a free drive slave …
 */
export function NewTagDialog({ tags, onOk, onClose }: { tags: Tag[]; onOk: (kind: TagKind, name: string) => boolean; onClose: () => void }): React.JSX.Element {
  const [kind, setKind] = useState<TagKind>('REG')
  const [name, setName] = useState('')
  const suggestion = newTag(tags, kind).name
  const ok = (): void => {
    if (onOk(kind, name.trim() || suggestion)) onClose()
  }
  return (
    <Modal
      title="New tag"
      onClose={onClose}
      actions={
        <>
          <Button size="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xl" variant="primary" onClick={ok}>
            Add
          </Button>
        </>
      }
    >
      <div
        className="addr-form"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return
          e.preventDefault() // step 19 lesson: the Enter is used here
          ok()
        }}
      >
        <Select
          label="Kind"
          options={NEW_KINDS.map((k) => ({ value: k, label: `${k} · ${KIND_LABEL[k] ?? k}` }))}
          value={kind}
          onChange={(e) => setKind(e.target.value as TagKind)}
          block
        />
        <Field label="Name" placeholder={suggestion} hint={`empty = ${suggestion}`} value={name} onChange={(e) => setName(e.target.value)} block />
      </div>
    </Modal>
  )
}
