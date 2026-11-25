/**
 * Live store: the single copy of runtime status, state and recent events in the renderer.
 * Components select only the slice they show, so only they re-render.
 * Step 31: connected at start-up (main.tsx); the header's runtime link reads status.
 */
import { create } from 'zustand'
import type { RuntimeEvent, RuntimeState, RuntimeStatus } from '@shared/ipc'
import { MODES, type MachineStatus, type PackMode, type PackState, ACTING, WAIT_STATES } from '@shared/packml'

const MAX_EVENTS = 200

interface LiveStore {
  status: RuntimeStatus
  state: RuntimeState
  events: RuntimeEvent[]
  /** step 32: PackML state + mode, from evt 'machine'; null until the runtime has sent one (kept when it goes offline) */
  machine: MachineStatus | null
}

export const useLive = create<LiveStore>(() => ({
  status: { link: 'connecting', url: '' },
  state: { seq: 0, values: {}, pc: {} },
  events: [],
  machine: null
}))

let connected = false

/** Subscribe once to the preload API. Safe to call more than once. */
export function connectLiveStore(): void {
  if (connected || !window.spm) return
  connected = true
  window.spm.runtime.onStatus((status) => useLive.setState({ status }))
  window.spm.runtime.onState((state) => useLive.setState({ state }))
  window.spm.runtime.onEvent((e) =>
    useLive.setState((s) => ({ events: [e, ...s.events].slice(0, MAX_EVENTS), machine: machineFrom(e) ?? s.machine }))
  )
}

const STATES: readonly string[] = [...WAIT_STATES, ...Object.keys(ACTING)]
/** evt { ev: 'machine', state, mode } → MachineStatus; anything else (or a bad value) → null */
export function machineFrom(e: RuntimeEvent): MachineStatus | null {
  if (e.ev !== 'machine' || !STATES.includes(String(e.state)) || !MODES.includes(e.mode as PackMode)) return null
  return { state: e.state as PackState, mode: e.mode as PackMode }
}
