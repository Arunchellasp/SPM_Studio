/**
 * Project store (screens): the open project and its tag table.
 * Talks to the main process through window.spm.project; in a plain browser
 * (web preview, Playwright) a stand-in opens the demo project instead.
 * Results are shown as toasts — never window.alert.
 */
import { create } from 'zustand'
import type { Addr, MenuCommand, ProjectInfo, StudioApi } from '@shared/ipc'
import { applyAddress, applyEdit, type EditField, type EditResult } from '../features/tags/tag-edit'
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
  /** edits not written to tags.json yet (step 19) */
  dirty: boolean
  /** ask main for a folder and load its tags.json */
  open: () => Promise<void>
  /** write the current tag table back to tags.json */
  save: () => Promise<void>
  /** change one cell; refused edits leave the table as it was and say why */
  edit: (name: string, field: EditField, value: unknown) => EditResult
  /** the address picker's result */
  setAddress: (name: string, addr: Addr) => EditResult
}

/** first error + how many more, short enough for a toast */
function firstError(errors: string[]): string {
  return errors.length > 1 ? `${errors[0]} (+${errors.length - 1} more)` : (errors[0] ?? 'unknown error')
}

export const useProject = create<ProjectState>((set, get) => ({
  project: null,
  busy: false,
  dirty: false,

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
        set({ project: res.project, dirty: false })
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
    set({ busy: true })
    try {
      const res = await api().project.save(p.tags)
      if (!res.ok) toast(`Not saved: ${firstError(res.errors)}`, 'error', 8000)
      else {
        set({ dirty: false })
        toast(res.changed ? `Saved ${res.file}` : 'No changes — tags.json is already up to date', res.changed ? 'done' : 'info')
      }
    } finally {
      set({ busy: false })
    }
  },

  edit: (name, field, value) => apply(applyEdit(get().project?.tags.tags ?? [], name, field, value)),
  setAddress: (name, addr) => apply(applyAddress(get().project?.tags.tags ?? [], name, addr))
}))

/** a good edit replaces the tag table (new objects → React redraws) and marks the project dirty; a refused one says why */
function apply(res: EditResult): EditResult {
  const p = useProject.getState().project
  if (!res.ok || !p) {
    if (!res.ok) toast(`Not changed: ${res.error}`, 'error', 6000)
    return res
  }
  useProject.setState({ project: { ...p, tags: { ...p.tags, tags: res.tags } }, dirty: true })
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
  })
}
