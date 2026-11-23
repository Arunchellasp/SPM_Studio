/**
 * Project store (screens): the open project and its tag table.
 * Talks to the main process through window.spm.project; in a plain browser
 * (web preview, Playwright) a stand-in opens the demo project instead.
 * Results are shown as toasts — never window.alert.
 */
import { create } from 'zustand'
import type { MenuCommand, ProjectInfo, StudioApi } from '@shared/ipc'
import { makeSimProject } from '../dev/sim-project'
import { toast } from './feedback.store'

let sim: Pick<StudioApi, 'project' | 'onMenu'> | null = null
function api(): Pick<StudioApi, 'project' | 'onMenu'> {
  if (window.spm?.project) return window.spm
  sim ??= makeSimProject()
  return sim
}

interface ProjectState {
  project: ProjectInfo | null
  busy: boolean
  /** ask main for a folder and load its tags.json */
  open: () => Promise<void>
  /** write the current tag table back to tags.json */
  save: () => Promise<void>
}

/** first error + how many more, short enough for a toast */
function firstError(errors: string[]): string {
  return errors.length > 1 ? `${errors[0]} (+${errors.length - 1} more)` : (errors[0] ?? 'unknown error')
}

export const useProject = create<ProjectState>((set, get) => ({
  project: null,
  busy: false,

  open: async () => {
    if (get().busy) return
    set({ busy: true })
    try {
      const res = await api().project.open()
      if (res.ok) {
        set({ project: res.project })
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
      else toast(res.changed ? `Saved ${res.file}` : 'No changes — tags.json is already up to date', res.changed ? 'done' : 'info')
    } finally {
      set({ busy: false })
    }
  }
}))

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
