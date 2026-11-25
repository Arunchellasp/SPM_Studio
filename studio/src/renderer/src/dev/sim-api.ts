/**
 * Browser simulator for window.spm.
 * Used only when the screens run outside Electron (plain browser preview, web demo).
 * Behaves like tools/mock-runtime.mjs: 20 Hz state, step / mode events, start / stop / write.
 * Step 31: the link behaves like the bridge (same LINK timing): window.spmSim stops, hangs or starts
 * the simulated runtime, so the header's OFFLINE can be tried without Electron.
 */
import { makeSimProject } from './sim-project'
import { PackMachine } from '@shared/packml-sim'
import { AlarmBook } from '@shared/alarm-sim'
import { DEMO_OVERVIEW } from '../fixtures/demo'
import type { PackCommand, PackMode } from '@shared/packml'
import { LINK, type CommandResult, type RuntimeEvent, type RuntimeState, type RuntimeStatus, type StudioApi } from '@shared/ipc'

type Cb<T> = (v: T) => void

/** running = answers; stopped = process gone (socket closes, connects refused); hung = socket open, no answer */
export type SimRuntime = 'running' | 'stopped' | 'hung'
export interface SimRuntimeControl {
  set(r: SimRuntime): void
  get(): SimRuntime
  /** step 33: raise / clear a demo alarm (E1202, W0310) as the runtime would */
  raise(code: string): void
  clear(code: string): void
}

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
  // step 32: the same simulated PackML machine as the mock runtime
  const machine = new PackMachine(() => {
    if (status.link === 'online' && runtime === 'running') emitEvent(machineEvt())
  })
  const machineEvt = (): RuntimeEvent => ({ ev: 'machine', ts: Date.now(), ...machine.status })
  // step 33: the alarm list starts like the design's N01 (E1202 unacked, W0310 acked)
  const alarms = new AlarmBook(
    (e) => {
      if (status.link === 'online' && runtime === 'running') emitEvent({ ts: Date.now(), ...e })
    },
    DEMO_OVERVIEW.alarms.map((a) => ({ ...a, active: true }))
  )

  // ---------------------------------------------------------------- the link, like bridge.ts
  let runtime: SimRuntime = 'running'
  let lastPong = Date.now()
  let backoff: number = LINK.BACKOFF_MIN_MS
  let retry: ReturnType<typeof setTimeout> | undefined
  const setStatus = (patch: Partial<RuntimeStatus>): void => {
    Object.assign(status, patch)
    statusCbs.forEach((cb) => cb({ ...status }))
  }
  const closed = (): void => {
    setStatus({ link: 'offline' })
    clearTimeout(retry)
    retry = setTimeout(connect, backoff)
    backoff = Math.min(backoff * 2, LINK.BACKOFF_MAX_MS)
  }
  function connect(): void {
    if (runtime === 'stopped') {
      setStatus({ lastError: 'connect ECONNREFUSED (simulated runtime stopped)' })
      closed()
      return
    }
    backoff = LINK.BACKOFF_MIN_MS
    lastPong = Date.now()
    setStatus({ link: 'online', lastError: undefined })
    emitEvent(machineEvt()) // like the mock runtime: the machine state on every new connection
    emitEvent({ ts: Date.now(), ...alarms.snapshot() }) // … and the whole alarm list
  }
  setInterval(() => {
    if (status.link === 'online' && runtime === 'running') lastPong = Date.now() // ping answered
  }, LINK.PING_MS)
  setInterval(() => {
    if (status.link === 'online' && Date.now() - lastPong > LINK.STALE_MS) {
      setStatus({ lastError: `no answer for ${LINK.STALE_MS / 1000} s (heartbeat lost)` })
      closed()
    }
  }, LINK.WATCHDOG_MS)
  const control: SimRuntimeControl = {
    set(r) {
      const was = runtime
      runtime = r
      if (r === 'stopped' && status.link === 'online') {
        setStatus({ lastError: undefined })
        closed() // the socket closes with the process
      }
      if (r === 'running' && was === 'hung' && status.link === 'online') lastPong = Date.now()
    },
    get: () => runtime,
    raise: (code) => {
      alarms.raise(code)
      if (code === 'E1202') machine.abort() // P1 → Abort, as in the mock runtime
    },
    clear: (code) => alarms.clear(code)
  }

  setInterval(() => {
    t += 0.05
    tick += 1
    tags.AI_Sealer_Temp = 180 + 5 * Math.sin(t)
    if (machine.running) {
      tags['AX_S1_X.pos'] = 300 + 300 * Math.sin(t * 0.8)
      if (tick % 40 === 0) {
        pc = (pc + 1) % steps.length
        tags.DI_S1_PartPresent = pc !== 0
        tags.DO_S1_ClampValve = pc >= 2 && pc <= 3
        if (pc === 4) tags.R_PartCount = (tags.R_PartCount as number) + 1
        emitEvent({ ev: 'step', ts: Date.now(), flow: 0, pc, name: steps[pc] })
      }
    }
    if (status.link !== 'online' || runtime !== 'running') return // no frames from a stopped or hung runtime
    const state: RuntimeState = { seq: ++seq, values: { ...tags }, pc: { '0': pc } }
    stateCbs.forEach((cb) => cb(state))
    if (tick % 20 === 0) {
      status.cycleMaxUs = 1000 + Math.round(Math.random() * 150)
      statusCbs.forEach((cb) => cb({ ...status }))
    }
  }, 50)

  const command = async (op: string, args: Record<string, unknown> = {}): Promise<CommandResult> => {
    if (status.link !== 'online') return { ok: false, err: 'OFFLINE', msg: 'runtime not connected' }
    switch (op) {
      case 'start':
      case 'hold':
      case 'stop':
      case 'reset':
        return machine.command(op as PackCommand)
      case 'mode':
        return machine.setMode(args.mode as PackMode)
      case 'ack':
        return alarms.ack(args.code, args.user)
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
      onEvent: (cb) => {
        setTimeout(() => cb({ ts: Date.now(), ...alarms.snapshot() }), 0)
        return sub(eventCbs, cb, machineEvt())
      }
    },
    ...makeSimProject()
  }
  window.spm = api
  window.spmSim = control
}
