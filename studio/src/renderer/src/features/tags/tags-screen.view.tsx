import { useEffect, useMemo, useState } from 'react'
import { AddressDialog } from './address-dialog.view'
import { ScaleDialog } from './scale-dialog.view'
import { NewTagDialog } from './new-tag-dialog.view'
import { BulkDialog } from './bulk-dialog.view'
import { ImportDialog } from './import-dialog.view'
import { toast } from '../../stores/feedback.store'
import { checkTags, type TagIssue } from '@shared/tags-rules'
import type { ScreenDef } from '../../app/screens'
import { Button } from '../../components/button.view'
import { Card } from '../../components/card.view'
import { Field } from '../../components/field.view'
import { Icon } from '../../components/icon.view'
import { Segmented } from '../../components/segmented.view'
import { Select } from '../../components/select.view'
import { useProject } from '../../stores/project.store'
import { TagDetails } from './tag-details.view'
import { countText, KIND_GROUPS, NO_FILTER, optionsOf, toGridRow, type GridFilter, type KindGroup } from './tag-grid'
import { TagGrid } from './tag-grid.view'
import { tagCountText } from './tags'
import './tags-screen.css'

/**
 * N03 Tags › Tag database (Improved design › N03).
 * Step 16: project bar (open / save). Step 18: toolbar (search, scope, type, kind groups), the tag grid
 * (Tabulator, sort by any column, virtual rows) and the details panel — read only; editing is step 19.
 */
export function TagsScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const project = useProject((s) => s.project)
  const busy = useProject((s) => s.busy)
  const open = useProject((s) => s.open)
  const save = useProject((s) => s.save)
  const dirty = useProject((s) => s.dirty)
  const edit = useProject((s) => s.edit)
  const setAddress = useProject((s) => s.setAddress)
  const setScale = useProject((s) => s.setScale)
  const add = useProject((s) => s.add)
  const duplicate = useProject((s) => s.duplicate)
  const remove = useProject((s) => s.remove)
  const undo = useProject((s) => s.undo)
  const redo = useProject((s) => s.redo)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const [adding, setAdding] = useState(false)
  const [bulk, setBulk] = useState(false)
  const generateTags = useProject((s) => s.generate)
  const copyStation = useProject((s) => s.copyStation)
  const exportTags = useProject((s) => s.exportTags)
  const readImport = useProject((s) => s.readImport)
  const applyImport = useProject((s) => s.applyImport)
  const importing = useProject((s) => s.importing)
  const cancelImport = useProject((s) => s.cancelImport)
  const [addrFor, setAddrFor] = useState<string | null>(null)
  const [scaleFor, setScaleFor] = useState<string | null>(null)

  const [filter, setFilter] = useState<GridFilter>(NO_FILTER)
  const [selected, setSelected] = useState<string | null>(null)
  const [shown, setShown] = useState(0)

  // step 20: the rules run on every change of the table (pure, ~1 ms for 1000 tags)
  const issues = useMemo(() => (project ? checkTags(project.tags.tags) : []), [project])
  const byTag = useMemo(() => {
    const m = new Map<string, TagIssue[]>()
    for (const i of issues) m.set(i.tag, [...(m.get(i.tag) ?? []), i])
    return m
  }, [issues])
  const rows = useMemo(() => (project ? project.tags.tags.map((t) => toGridRow(t, byTag.get(t.name))) : []), [project, byTag])
  const scopes = useMemo(() => optionsOf(rows, 'scope'), [rows])
  const types = useMemo(() => optionsOf(rows, 'type'), [rows])
  const selTag = project?.tags.tags.find((t) => t.name === selected) ?? null
  const selRow = rows.find((r) => r.name === selected) ?? null

  /** Delete: the row goes, the toast says how to get it back */
  const removeTag = (name: string): void => {
    if (remove(name).ok) {
      setSelected(null)
      toast(`Deleted ${name} — Ctrl+Z brings it back`, 'info')
    }
  }

  // step 21 keys on N03: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Delete removes the selected tag.
  // Not while typing (a field, a grid editor) and not while a dialog is open: there the keys belong to the text.
  useEffect(() => {
    if (!project) return
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"], .tabulator-editing, .dlg-backdrop')) return
      if (document.querySelector('.dlg-backdrop')) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'z') {
        e.preventDefault()
        if (!undo()) toast('Nothing to undo', 'info')
      } else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) {
        e.preventDefault()
        if (!redo()) toast('Nothing to redo', 'info')
      } else if (e.key === 'Delete' && !e.ctrlKey && !e.altKey && selected) {
        e.preventDefault()
        removeTag(selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const buttons = (
    <>
      {project && (
        <>
          <Button size="md" variant="quiet" icon={<Icon name="undo" />} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" onClick={() => undo()} disabled={!canUndo} />
          <Button size="md" variant="quiet" icon={<Icon name="redo" />} aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)" onClick={() => redo()} disabled={!canRedo} />
        </>
      )}
      {project && (
        <>
          <Button size="md" variant="quiet" onClick={() => void readImport()} disabled={busy} title="Excel / CSV → tag table (preview first)">
            Import…
          </Button>
          <Button size="md" variant="quiet" onClick={() => void exportTags()} disabled={busy} title="tag table → Excel / CSV">
            Export…
          </Button>
        </>
      )}
      <Button size="md" icon={<Icon name="open" />} onClick={() => void open()} disabled={busy}>
        Open project…
      </Button>
      <Button size="md" variant={dirty ? 'primary' : 'default'} icon={<Icon name="save" />} onClick={() => void save()} disabled={busy || !project}>
        Save
      </Button>
    </>
  )

  if (!project) {
    return (
      <div className="tgs">
        <div className="tgs-head">
          <h1>
            <span className="tgs-code">{screen.code}</span> {screen.title}
          </h1>
          <p className="tgs-purpose">{screen.purpose}</p>
        </div>
        <Card title="Project" className="tgs-project" actions={buttons}>
          <p className="tgs-note" data-testid="project-none">
            No project open. Open a project folder (the folder that holds tags.json) with Open project…, or File › Open project… (Ctrl+O).
          </p>
        </Card>
      </div>
    )
  }

  const set = (patch: Partial<GridFilter>): void => setFilter((f) => ({ ...f, ...patch }))
  const addrTag = project.tags.tags.find((t) => t.name === addrFor) ?? null
  const scaleTag = project.tags.tags.find((t) => t.name === scaleFor) ?? null
  const problemTags = [...byTag.keys()]

  /** a grid edit → store; a renamed selected tag stays selected */
  const onEdit = (name: string, field: Parameters<typeof edit>[1], value: unknown): boolean => {
    const res = edit(name, field, value)
    if (res.ok && field === 'name' && selected === name) setSelected(res.tag.name)
    return res.ok
  }

  return (
    <div className="tgs tgs-open">
      <h1 className="sr-only">
        {screen.code} {screen.title}
      </h1>
      <div className="tgs-bar" aria-label="Open project">
        <span className="tgs-bar-label">Project</span>
        <b data-testid="project-name">{project.name}</b>
        <span className="tgs-path" title={project.dir}>
          {project.dir}
        </span>
        <span data-testid="project-count">
          {tagCountText(project.tags.tags.length)} · format {project.tags.schema}
        </span>
        {issues.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            data-testid="project-problems"
            title="Save is blocked until these are fixed. Click: go to the next tag with a problem."
            onClick={() => {
              // next problem after the selected one (round), and show all kinds so it is visible
              const i = selected ? problemTags.indexOf(selected) : -1
              setFilter(NO_FILTER)
              setSelected(problemTags[(i + 1) % problemTags.length] ?? null)
            }}
          >
            ⚠ {issues.length} {issues.length === 1 ? 'problem' : 'problems'}
          </Button>
        )}
        {dirty && (
          <span className="tgs-dirty" data-testid="project-dirty">
            ● unsaved changes
          </span>
        )}
        <span className="tgs-bar-actions">{buttons}</span>
      </div>

      <div className="tgs-toolbar">
        <Field
          label="Search tags"
          className="tgs-nolabel tgs-search"
          placeholder="Search tags…"
          type="search"
          value={filter.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <Select
          label="Scope"
          className="tgs-nolabel tgs-select"
          value={filter.scope}
          onChange={(e) => set({ scope: e.target.value })}
          options={[{ value: 'all', label: 'Scope: all' }, ...scopes.map((s) => ({ value: s, label: `Scope: ${s}` }))]}
        />
        <Select
          label="Type"
          className="tgs-nolabel tgs-select"
          value={filter.type}
          onChange={(e) => set({ type: e.target.value })}
          options={[{ value: 'all', label: 'Type: all' }, ...types.map((t) => ({ value: t, label: `Type: ${t}` }))]}
        />
        <Segmented<KindGroup> label="Kind" className="tgs-kinds" options={KIND_GROUPS} value={filter.group} onChange={(group) => set({ group })} />
        <span className="tgs-count" data-testid="grid-count" aria-live="polite">
          {countText(shown, rows.length)}
        </span>
        <Button size="md" onClick={() => setBulk(true)} title="Generate I/O for a card · copy a station">
          Bulk…
        </Button>
        <Button variant="primary" size="md" icon={<Icon name="plus" />} onClick={() => setAdding(true)}>
          New tag
        </Button>
      </div>

      <div className="tgs-body">
        <TagGrid
          rows={rows}
          scopes={scopes}
          filter={filter}
          selected={selected}
          onSelect={setSelected}
          onCount={setShown}
          onEdit={onEdit}
          onPickAddress={setAddrFor}
        />
        <TagDetails
          project={project}
          tag={selTag}
          row={selRow}
          issues={selTag ? (byTag.get(selTag.name) ?? []) : []}
          onPickAddress={setAddrFor}
          onPickScale={setScaleFor}
          onDuplicate={(n) => {
            const r = duplicate(n)
            if (r.ok) setSelected(r.tag.name)
          }}
          onDelete={removeTag}
          onKind={(kind) => selTag && onEdit(selTag.name, 'kind', kind)}
        />
      </div>

      {importing && (
        <ImportDialog
          file={importing.file}
          incoming={importing.tags}
          errors={importing.errors}
          current={project.tags.tags}
          onClose={cancelImport}
          onOk={(mode) => {
            if (applyImport(mode).ok) setFilter(NO_FILTER)
          }}
        />
      )}
      {bulk && (
        <BulkDialog
          tags={project.tags.tags}
          onClose={() => setBulk(false)}
          onGenerate={(spec) => {
            const r = generateTags(spec)
            if (r.ok) {
              setFilter(NO_FILTER)
              setSelected(r.tag.name)
            }
            return r.ok
          }}
          onCopy={(spec) => {
            const r = copyStation(spec)
            if (r.ok) {
              setFilter(NO_FILTER)
              setSelected(r.tag.name)
            }
            return r.ok
          }}
        />
      )}
      {adding && (
        <NewTagDialog
          tags={project.tags.tags}
          onClose={() => setAdding(false)}
          onOk={(kind, name) => {
            const r = add(kind, name)
            if (r.ok) {
              setFilter(NO_FILTER) // the new tag must be visible
              setSelected(r.tag.name)
              toast(`Added ${r.tag.name}`, 'done')
            }
            return r.ok
          }}
        />
      )}
      {scaleTag && <ScaleDialog tag={scaleTag} onOk={(sc) => setScale(scaleTag.name, sc).ok} onClose={() => setScaleFor(null)} />}
      {addrTag && <AddressDialog tag={addrTag} onOk={(a) => setAddress(addrTag.name, a).ok} onClose={() => setAddrFor(null)} />}
    </div>
  )
}
