import { useId, useState } from 'react'
import type { Tag } from '@shared/ipc'
import { Field } from '../../components/field.view'

/**
 * TagPicker (step 25): a text field whose suggestion list holds ONLY the tags this field accepts
 * (Software implementation › 4b: autocomplete filtered by kind). Typing filters the list (browser datalist);
 * the value is taken on Enter or when leaving the field — a name that is not offered is refused with the reason.
 */
export function TagPicker({
  label,
  value,
  options,
  offers,
  commit
}: {
  label: string
  value: string
  options: Tag[]
  /** what the list offers, in words — shown under the field */
  offers: string
  /** '' = taken; otherwise the reason it was not */
  commit: (text: string) => string
}): React.JSX.Element {
  const listId = useId()
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const take = (): void => {
    if (draft === value) return setError('')
    setError(commit(draft))
  }
  return (
    <div className="seq-prop">
      <Field
        label={label}
        list={listId}
        value={draft}
        placeholder="choose a tag"
        error={error || undefined}
        hint={error ? undefined : `${options.length} ${offers}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={take}
        onKeyDown={(e) => e.key === 'Enter' && take()}
        autoComplete="off"
        block
      />
      <datalist id={listId} data-testid={`list-${label}`}>
        {options.map((t) => (
          <option key={t.name} value={t.name}>
            {t.desc ?? t.text ?? t.kind}
          </option>
        ))}
      </datalist>
    </div>
  )
}
