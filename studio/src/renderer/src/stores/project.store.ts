/**
 * Project store (screens): the open project and its tag table.
 * Talks to the main process through window.spm.project; in a plain browser
 * (web preview, Playwright) a stand-in opens the demo project instead.
 * Results are shown as toasts — never window.alert.
 */
import { create } from 'zustand'
import type { Addr, MenuCommand, ProjectImportResult, ProjectInfo, StudioApi, Tag, TagKind } from '@shared/ipc'
import { applyImport } from '@shared/tag-table'
import { copyStation, generate, type CopySpec, type GenerateSpec } from '../features/tags/tag-bulk'
import { useUi } from './ui.store'
import { applyAdd, applyAddress, applyDelete, applyDuplicate, applyEdit, applyScale, type EditField, type EditResult } from '../features/tags/tag-edit'
import { checkTags, issueText } from '@shared/tags-rules'
import { makeSimProject } from '../dev/sim-project'
import { confirmDialog, toast } from './feedback.store'

let sim: Pick<StudioApi, 'project' | 'onMenu'> | null = null
function api(): Pick<StudioApi, 'project' | 'onMenu'> {
  if (window.spm?.project) return window.spm
  sim ??= makeSimProject()
  return sim
}

interface ProjectState {
  project: ProjectInfo | null
  busy: boolean
  /** edits not written to tags.json yet (step 19) = the table differs from the one last opened / saved */
  dirty: boolean
  /** step 21: earlier tables (newest last, at most UNDO_STEPS) and undone ones for redo */
  past: Tag[][]
  future: Tag[][]
  /** the table as it is on disk (after open / save) */
  saved: Tag[] | null
  /** ask main for a folder and load its tags.json */
  open: () => Promise<void>
  /** write the current tag table back to tags.json */
  save: () => Promise<void>
  /** change one cell; refused edits leave the table as it was and say why */
  edit: (name: string, field: EditField, value: unknown) => EditResult
  /** the address picker's result */
  setAddress: (name: string, addr: Addr) => EditResult
  /** the scaling dialog's result (AI / AO) */
  setScale: (name: string, scale: { raw: [number, number]; eng: [number, number] }) => EditResult
  /** step 21 */
  add: (kind: TagKind, name?: string) => EditResult
  duplicate: (name: string) => EditResult
  remove: (name: string) => EditResult
  undo: () => boolean
  redo: () => boolean
  /** step 22 */
  generate: (spec: GenerateSpec) => EditResult
  copyStation: (spec: CopySpec) => EditResult
  exportTags: () => Promise<void>
  /** asks main for a file; its rows wait in 'importing' for the preview (nothing in the table changes yet) */
  readImport: () => Promise<void>
  /** the file read for import, shown in N03's preview dialog until Import / Cancel */
  importing: Extract<ProjectImportResult, { ok: true }> | null
  applyImport: (mode: 'merge' | 'replace') => EditResult
  cancelImport: () => void
}

/** how many changes can be undone (roadmap: 20) */
export const UNDO_STEPS = 20

/** first error + how many more, short enough for a toast */
function firstError(errors: string[]): string {
  return errors.length > 1 ? `${errors[0]} (+${errors.length - 1} more)` : (errors[0] ?? 'unknown error')
}

export const useProject = create<ProjectState>((set, get) => ({
  project: null,
  busy: false,
  dirty: false,
  past: [],
  future: [],
  saved: null,
  importing: null,

  open: async () => {
    if (get().busy) return
    if (get().dirty) {
      const go = await confirmDialog({
        title: 'Discard unsaved changes?',
        message: `${get().project?.name ?? 'The project'} has changes that are not saved. Open another project and lose them?`,
        confirmLabel: 'Discard and open',
        danger: true
      })
      if (!go) return
    }
    set({ busy: true })
    try {
      const res = await api().project.open()
      if (res.ok) {
        set({ project: res.project, dirty: false, past: [], future: [], saved: res.project.tags.tags })
        toast(`Opened ${res.project.name} · ${res.project.tags.tags.length} tags`, 'done')
      } else if (!res.cancelled) {
        toast(`Could not open the project: ${firstError(res.errors)}`, 'error', 8000)
      }
    } finally {
      set({ busy: false })
    }
  },

  save: async () => {
    const p = get().project
    if (!p) {
      toast('No project open — File › Open project… (Ctrl+O)', 'info')
      return
    }
    if (get().busy) return
    // step 20: no save while a rule fails — the red cells say what to fix
    const issues = checkTags(p.tags.tags)
    if (issues.length) {
      const n = issues.length
      toast(`Not saved: ${n} ${n === 1 ? 'problem' : 'problems'} — ${issueText(issues[0]!)}`, 'error', 8000)
      return
    }
    set({ busy: true })
    try {
      const res = await api().project.save(p.tags)
      if (!res.ok) toast(`Not saved: ${firstError(res.errors)}`, 'error', 8000)
      else {
        set({ dirty: false, saved: p.tags.tags })
        toast(res.changed ? `Saved ${res.file}` : 'No changes — tags.json is already up to date', res.changed ? 'done' : 'info')
      }
    } finally {
      set({ busy: false })
    }
  },

  edit: (name, field, value) => apply(applyEdit(get().project?.tags.tags ?? [], name, field, value)),
  setAddress: (name, addr) => apply(applyAddress(get().project?.tags.tags ?? [], name, addr)),
  setScale: (name, scale) => apply(applyScale(get().project?.tags.tags ?? [], name, scale)),
  add: (kind, name) => apply(applyAdd(get().project?.tags.tags ?? [], kind, name)),
  duplicate: (name) => apply(applyDuplicate(get().project?.tags.tags ?? [], name)),
  remove: (name) => apply(applyDelete(get().project?.tags.tags ?? [], name)),

  generate: (spec) => apply(generate(get().project?.tags.tags ?? [], spec)),
  copyStation: (spec) => apply(copyStation(get().project?.tags.tags ?? [], spec)),

  exportTags: async () => {
    const p = get().project
    if (!p) return void toast('No project open — File › Open project… (Ctrl+O)', 'info')
    const res = await api().project.exportTags(p.tags.tags)
    if (res.ok) toast(`Exported ${p.tags.tags.length} tags to ${res.file}`, 'done')
    else if (!res.cancelled) toast(`Not exported: ${firstError(res.errors)}`, 'error', 8000)
  },

  readImport: async () => {
    if (!get().project) return void toast('Open a project first — the import goes into its tag table', 'info')
    const res = await api().project.importTags()
    if (res.ok) set({ importing: res })
    else if (!res.cancelled) toast(`Not imported: ${firstError(res.errors)}`, 'error', 8000)
  },

  applyImport: (mode) => {
    const imp = get().importing
    const cur = get().project?.tags.tags ?? []
    set({ importing: null })
    if (!imp) return { ok: false, error: 'nothing to import' }
    const tags = applyImport(cur, imp.tags, mode)
    return apply({ ok: true, tags, tag: imp.tags[0] ?? cur[0]!, note: `Imported ${imp.tags.length} tags (${mode}) — Ctrl+Z takes it back` })
  },
  cancelImport: () => set({ importing: null }),

  undo: () => {
    const { project: p, past, future, saved } = get()
    const prev = past.at(-1)
    if (!p || !prev) return false
    set({ project: withTags(p, prev), past: past.slice(0, -1), future: [...future, p.tags.tags], dirty: prev !== saved })
    return true
  },
  redo: () => {
    const { project: p, past, future, saved } = get()
    const next = future.at(-1)
    if (!p || !next) return false
    set({ project: withTags(p, next), past: [...past, p.tags.tags].slice(-UNDO_STEPS), future: future.slice(0, -1), dirty: next !== saved })
    return true
  }
}))

function withTags(p: ProjectInfo, tags: Tag[]): ProjectInfo {
  return { ...p, tags: { ...p.tags, tags } }
}

/**
 * A good edit replaces the tag table (new objects → React redraws), keeps the old table for undo
 * (step 21: tables share every unchanged tag, so a step costs one array) and clears redo. A refused one says why.
 */
function apply(res: EditResult): EditResult {
  const { project: p, past, saved } = useProject.getState()
  if (!res.ok || !p) {
    if (!res.ok) toast(`Not changed: ${res.error}`, 'error', 6000)
    return res
  }
  if (res.tags === p.tags.tags) return res // nothing changed (e.g. same value typed again)
  useProject.setState({
    project: withTags(p, res.tags),
    past: [...past, p.tags.tags].slice(-UNDO_STEPS),
    future: [],
    dirty: res.tags !== saved
  })
  if (res.note) toast(res.note, 'info')
  return res
}

let menuConnected = false
/** File menu (Ctrl+O / Ctrl+S) → this store. Safe to call more than once. */
export function connectProjectMenu(): void {
  if (menuConnected) return
  menuConnected = true
  api().onMenu((cmd: MenuCommand) => {
    if (cmd === 'project.open') void useProject.getState().open()
    if (cmd === 'project.save') void useProject.getState().save()
    if (cmd === 'project.export') void useProject.getState().exportTags()
    if (cmd === 'project.import') {
      useUi.getState().openScreen('tags') // the preview lives on N03
      void useProject.getState().readImport()
    }
  })
}
