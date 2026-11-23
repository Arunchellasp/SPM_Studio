import { useState } from 'react'
import { Button } from '../../components/button.view'
import { Field } from '../../components/field.view'
import { Segmented } from '../../components/segmented.view'
import { useProject } from '../../stores/project.store'
import { useSequence } from '../../stores/sequence.store'
import { useUi } from '../../stores/ui.store'
import { stepDef, summary, type FlowNode, type StepKind, type StepParams } from './flow'
import { afterChange, FIELDS, parseField, tagsFor, type FieldDef } from './node-schema'
import { TagPicker } from './tag-picker.view'

/** text / number field: draft while typing, taken on Enter or leaving the field; a bad value shows why and is not taken */
function DraftField({
  label,
  value,
  unit,
  hint,
  numeric,
  commit
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  numeric?: boolean
  commit: (text: string) => string
}): React.JSX.Element {
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
        value={draft}
        unit={unit}
        inputMode={numeric ? 'numeric' : undefined}
        error={error || undefined}
        hint={error ? undefined : hint}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={take}
        onKeyDown={(e) => e.key === 'Enter' && take()}
        block
      />
    </div>
  )
}

/**
 * N02 Properties (Improved design › N02, right; step 25): the selected node's form, drawn from FIELDS.
 * Tag fields offer only tags of the right kind from the project open in N03.
 */
export function PropertyPanel(): React.JSX.Element {
  const node = useSequence((s) => (s.nodes.filter((n) => n.selected).length === 1 ? s.nodes.find((n) => n.selected) : undefined))
  const many = useSequence((s) => s.nodes.filter((n) => n.selected).length > 1)
  if (many) return <p className="seq-later">Several nodes are selected — select one to edit it.</p>
  if (!node) return <p className="seq-later">Click a node to edit it here.</p>
  if (node.type === 'start' || node.type === 'end')
    return <p className="seq-later">{node.type === 'start' ? 'Start: the flow begins here.' : 'End: the flow is finished here.'} Nothing to set.</p>
  // key: a fresh form (fresh drafts) for every node
  return <StepForm key={node.id} node={node} />
}

function StepForm({ node }: { node: FlowNode }): React.JSX.Element {
  const type = node.type as StepKind
  const def = stepDef(type)
  const p = node.data.p as StepParams[StepKind]
  const tags = useProject((s) => s.project?.tags.tags)
  const updateNode = useSequence((s) => s.updateNode)
  const openScreen = useUi((s) => s.openScreen)

  const set = (f: FieldDef, raw: string | boolean): string => {
    const r = parseField(type, f, raw, tags ?? [], p)
    if (!r.ok) return r.error
    updateNode(node.id, { p: afterChange(type, f.key, { ...p, [f.key]: r.value } as StepParams[StepKind], tags ?? []) })
    return ''
  }

  return (
    <div className="seq-form" aria-label={`Properties of ${node.data.name || def.title}`}>
      <p className="seq-form-kind">
        {def.title} · {def.op} · done when {def.done}
      </p>
      <p className="seq-form-sum" data-testid="prop-summary">
        {summary(type, p)}
      </p>
      <DraftField key={`name-${node.data.name ?? ''}`} label="Name" value={node.data.name ?? ''} hint={`shown on the node instead of '${def.title}'`} commit={(t) => (updateNode(node.id, { name: t.trim() || undefined }), '')} />
      {!tags && (
        <div className="seq-notags" role="note">
          No project open — tag fields need the tags of a project.
          <Button size="sm" variant="ghost" onClick={() => openScreen('tags')}>
            Open one in Tags
          </Button>
        </div>
      )}
      {FIELDS[type].map((f) => {
        const value = (p as Record<string, unknown>)[f.key]
        if (f.kind === 'bool')
          return (
            <div className="seq-prop" key={f.key}>
              <span className="field-label">{f.label}</span>
              <Segmented
                label={f.label}
                options={[
                  { value: 'TRUE', label: 'TRUE' },
                  { value: 'FALSE', label: 'FALSE' }
                ]}
                value={value ? 'TRUE' : 'FALSE'}
                onChange={(v) => set(f, v)}
              />
            </div>
          )
        if (f.kind === 'tag')
          return tags ? (
            <TagPicker key={`${f.key}-${String(value)}`} label={f.label} value={String(value ?? '')} options={tagsFor(type, f, tags, p)} offers={f.offers ?? 'tags'} commit={(t) => set(f, t)} />
          ) : (
            <DraftField key={f.key} label={f.label} value={String(value ?? '')} hint="needs an open project" commit={() => 'open a project first (Tags)'} />
          )
        return <DraftField key={`${f.key}-${String(value)}`} label={f.label} value={String(value ?? '')} unit={f.unit} hint={f.hint} numeric commit={(t) => set(f, t)} />
      })}
      <DraftField key={`comment-${node.data.comment ?? ''}`} label="Comment" value={node.data.comment ?? ''} commit={(t) => (updateNode(node.id, { comment: t.trim() || undefined }), '')} />
    </div>
  )
}
