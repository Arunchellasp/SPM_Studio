/**
 * Step 34 · the compiled program of the open project, as the canvas knows it (rt), and Download.
 * compile(): quiet, after Open and Save — the canvas needs the step table to map the runtime's pc to nodes.
 * download(): compile + send to the runtime (main checks nothing is unsaved; the runtime checks STOPPED, schema, CRC).
 */
import { create } from 'zustand'
import type { BuildResult } from '@shared/ipc'
import type { RtFile } from '@shared/generated/rt'
import { toast } from './feedback.store'

interface OnlineState {
  /** the step table compiled from the saved files (null: none yet, or it did not compile) */
  rt: RtFile | null
  /** problems of the last compile / download, for Build output */
  errors: string[]
  stage: Extract<BuildResult, { ok: false }>['stage'] | null
  busy: boolean
  compile: () => Promise<void>
  download: () => Promise<boolean>
  clear: () => void
}

const api = (): typeof window.spm | undefined => globalThis.window?.spm

export const useOnline = create<OnlineState>()((set, get) => {
  const run = async (download: boolean): Promise<BuildResult | null> => {
    const a = api()
    if (!a || get().busy) return null
    set({ busy: true })
    try {
      const r = await a.project.build(download)
      if (r.ok) set({ rt: r.rt, errors: [], stage: null })
      else set({ errors: r.errors, stage: r.stage, ...(r.stage === 'compile' || r.stage === 'project' ? { rt: null } : {}) })
      return r
    } finally {
      set({ busy: false })
    }
  }
  return {
    rt: null,
    errors: [],
    stage: null,
    busy: false,
    compile: async () => void (await run(false)),
    download: async () => {
      const r = await run(true)
      if (!r) return false
      if (r.ok)
        toast(`Downloaded to the runtime · ${r.rt.flows.length} ${r.rt.flows.length === 1 ? 'flow' : 'flows'} · CRC ${r.rt.crc}`, 'done')
      else
        toast(
          `Not downloaded: ${r.errors[0] ?? 'no reason given'}${r.errors.length > 1 ? ` (+${r.errors.length - 1} more in Build output)` : ''}`,
          'error',
          8000
        )
      return r.ok
    },
    clear: () => set({ rt: null, errors: [], stage: null })
  }
})
