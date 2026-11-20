/**
 * Browser simulator for window.spm.
 * Used only when the screens run outside Electron (plain browser preview, web demo).
 * Behaves like tools/mock-runtime.mjs: 20 Hz state, step / mode events, start / stop / write.
 */
import type { CommandResult, RuntimeEvent, RuntimeState, RuntimeStatus, StudioApi } from '@shared/ipc'

type Cb<T> = (v: T) => void

export function installSimApi(): void {
  const statusCbs = new Set<Cb<RuntimeStatus>>()
  const stateCbs = new Set<Cb<RuntimeState>>()
  const eventCbs = new Set<Cb<RuntimeEvent>>()

  const tags: Record<string, number | boolean> = {
    DI_S1_PartPresent: false,
    'AX_S1_X.pos': 0,
    AI_Sealer_Temp: 25,
    R_PartCount: 0,
    DO_S1_ClampValve: false
  }
  const steps = ['wait part', 'move X to pick', 'clamp', 'seal', 'count']
  let running = false
  let pc = 0
  let seq = 0
  let t = 0
  let tick = 0

  const status: RuntimeStatus = {
    link: 'online',
    url: 'simulator (browser)',
    runtimeVersion: '0.0.0-sim',
    cycleUs: 1000,
    cycleMaxUs: 1000
  }

  const emitEvent = (e: RuntimeEvent): void => eventCbs.forEach((cb) => cb(e))

  setInterval(() => {
    t += 0.05
    tick += 1
    tags.AI_Sealer_Temp = 180 + 5 * Math.sin(t)
    if (running) {
      tags['AX_S1_X.pos'] = 300 + 300 * Math.sin(t * 0.8)
      if (tick % 40 === 0) {
        pc = (pc + 1) % steps.length
        tags.DI_S1_PartPresent = pc !== 0
        tags.DO_S1_ClampValve = pc >= 2 && pc <= 3
        if (pc === 4) tags.R_PartCount = (tags.R_PartCount as number) + 1
        emitEvent({ ev: 'step', ts: Date.now(), flow: 0, pc, name: steps[pc] })
      }
    }
    const state: RuntimeState = { seq: ++seq, values: { ...tags }, pc: { '0': pc } }
    stateCbs.forEach((cb) => cb(state))
    if (tick % 20 === 0) {
      status.cycleMaxUs = 1000 + Math.round(Math.random() * 150)
      statusCbs.forEach((cb) => cb({ ...status }))
    }
  }, 50)

  const command = async (op: string, args: Record<string, unknown> = {}): Promise<CommandResult> => {
    switch (op) {
      case 'start':
        running = true
        emitEvent({ ev: 'mode', ts: Date.now(), mode: 'AUTO' })
        return { ok: true }
      case 'stop':
        running = false
        emitEvent({ ev: 'mode', ts: Date.now(), mode: 'STOP' })
        return { ok: true }
      case 'write': {
        const tag = String(args.tag)
        if (!(tag in tags)) return { ok: false, err: 'UNKNOWN_TAG', msg: `no tag ${tag}` }
        tags[tag] = args.value as number | boolean
        return { ok: true }
      }
      default:
        return { ok: false, err: 'UNKNOWN_OP', msg: `op '${op}' not supported by simulator` }
    }
  }

  const sub = <T>(set: Set<Cb<T>>, cb: Cb<T>, first?: T): (() => void) => {
    set.add(cb)
    if (first !== undefined) setTimeout(() => cb(first), 0)
    return () => set.delete(cb)
  }

  const api: StudioApi = {
    appInfo: async () => ({
      name: 'spm-studio',
      version: '0.1.0',
      electron: 'browser preview',
      chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? '—',
      node: '—',
      platform: 'web'
    }),
    runtime: {
      command,
      onStatus: (cb) => sub(statusCbs, cb, { ...status }),
      onState: (cb) => sub(stateCbs, cb),
      onEvent: (cb) => sub(eventCbs, cb)
    }
  }
  window.spm = api
}
