/**
 * Live store: the single copy of runtime status, state and recent events in the renderer.
 * Components select only the slice they show, so only they re-render.
 * Step 31: connected at start-up (main.tsx); the header's runtime link reads status.
 */
import { create } from 'zustand'
import type { RuntimeEvent, RuntimeState, RuntimeStatus } from '@shared/ipc'

const MAX_EVENTS = 200

interface LiveStore {
  status: RuntimeStatus
  state: RuntimeState
  events: RuntimeEvent[]
}

export const useLive = create<LiveStore>(() => ({
  status: { link: 'connecting', url: '' },
  state: { seq: 0, values: {}, pc: {} },
  events: []
}))

let connected = false

/** Subscribe once to the preload API. Safe to call more than once. */
export function connectLiveStore(): void {
  if (connected || !window.spm) return
  connected = true
  window.spm.runtime.onStatus((status) => useLive.setState({ status }))
  window.spm.runtime.onState((state) => useLive.setState({ state }))
  window.spm.runtime.onEvent((e) => useLive.setState((s) => ({ events: [e, ...s.events].slice(0, MAX_EVENTS) })))
}
