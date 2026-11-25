/**
 * Step 32 · may this header button be pressed now, and if not, why (shown as its tooltip)?
 * Three checks, in this order: runtime online · role may do it · PackML allows it in this state.
 */
import type { LinkState } from '@shared/ipc'
import { changeMode, command, type PackCommand, type PackMode, type PackState } from '@shared/packml'
import { may, type Role } from '@shared/roles'

export interface CommandContext {
  link: LinkState
  state: PackState
  mode: PackMode
  role: Role
}
export interface CommandView {
  enabled: boolean
  /** the tooltip: what it does, or why it is off */
  why: string
}

const DOES: Record<PackCommand, string> = {
  start: 'Start the machine (on a held machine: continue)',
  hold: 'Hold: pause at the next safe point',
  stop: 'Stop the machine',
  reset: 'Reset (on ABORTED: clear)'
}
const VERB: Record<PackCommand, string> = { start: 'start', hold: 'hold', stop: 'stop', reset: 'reset' }

export function commandView(cmd: PackCommand, c: CommandContext): CommandView {
  if (c.link !== 'online') return { enabled: false, why: 'Runtime OFFLINE — no commands' }
  if (!may(c.role, cmd)) return { enabled: false, why: `Your role (${c.role}) may not ${VERB[cmd]} the machine` }
  const r = command(c.state, cmd)
  return r.ok ? { enabled: true, why: DOES[cmd] } : { enabled: false, why: r.reason }
}

/** one mode segment: the current one is always shown selected, the others only when a change is allowed */
export function modeView(mode: PackMode, c: CommandContext): CommandView {
  if (mode === c.mode) return { enabled: true, why: `Mode ${mode}` }
  if (c.link !== 'online') return { enabled: false, why: 'Runtime OFFLINE — the mode cannot change' }
  if (!may(c.role, `mode:${mode}`)) return { enabled: false, why: `Your role (${c.role}) may not switch to ${mode}` }
  const r = changeMode(c.state, mode)
  return r.ok ? { enabled: true, why: `Switch to ${mode}` } : { enabled: false, why: r.reason }
}
