/**
 * Step 32 · a simulated PackML machine for the stand-ins of the C runtime:
 * tools/mock-runtime.mjs (WebSocket) and the browser simulator (dev/sim-api.ts) run the same one.
 * Commands follow packml.ts; an acting state (STARTING …) finishes after ACTING_MS by itself.
 */
import { changeMode, command, isActing, settle, type MachineStatus, type PackCommand, type PackMode } from './packml'

export const ACTING_MS = 800

export type SimReply = { ok: true } | { ok: false; err: 'STATE' | 'MODE'; msg: string }

export class PackMachine {
  status: MachineStatus = { state: 'STOPPED', mode: 'Auto' }
  private timer?: ReturnType<typeof setTimeout>

  /** onChange: every new state or mode (the runtime sends it as evt 'machine') */
  constructor(private readonly onChange: (s: MachineStatus) => void) {}

  command(cmd: PackCommand): SimReply {
    const r = command(this.status.state, cmd)
    if (!r.ok) return { ok: false, err: 'STATE', msg: r.reason }
    this.set({ state: r.next })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.set({ state: settle(this.status.state) }), ACTING_MS)
    return { ok: true }
  }

  setMode(mode: PackMode): SimReply {
    const r = changeMode(this.status.state, mode)
    if (!r.ok) return { ok: false, err: 'MODE', msg: r.reason }
    this.set({ mode })
    return { ok: true }
  }

  get running(): boolean {
    return this.status.state === 'EXECUTE'
  }

  get acting(): boolean {
    return isActing(this.status.state)
  }

  private set(patch: Partial<MachineStatus>): void {
    this.status = { ...this.status, ...patch }
    this.onChange(this.status)
  }
}
