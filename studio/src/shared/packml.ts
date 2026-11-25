/**
 * Step 32 · PackML state model (Improved design › "a) Machine sequence"): the ONE copy of the rules.
 * Used by the mock runtime (tools/mock-runtime.mjs), the browser simulator and the header buttons;
 * the C runtime implements the same table later (phase H).
 *
 * Wait states hold until a command; acting states finish by themselves (ACTING → the next wait state).
 * Stop works from every state except the abort group; Abort (E-stop, P1 alarm) is not a header button.
 */
export const WAIT_STATES = ['STOPPED', 'IDLE', 'EXECUTE', 'COMPLETE', 'HELD', 'SUSPENDED', 'ABORTED'] as const
export const ACTING = {
  RESETTING: 'IDLE',
  STARTING: 'EXECUTE',
  COMPLETING: 'COMPLETE',
  HOLDING: 'HELD',
  UNHOLDING: 'EXECUTE',
  SUSPENDING: 'SUSPENDED',
  UNSUSPENDING: 'EXECUTE',
  STOPPING: 'STOPPED',
  ABORTING: 'ABORTED',
  CLEARING: 'STOPPED'
} as const

export type WaitState = (typeof WAIT_STATES)[number]
export type ActingState = keyof typeof ACTING
export type PackState = WaitState | ActingState

/** the four header buttons */
export const COMMANDS = ['start', 'hold', 'stop', 'reset'] as const
export type PackCommand = (typeof COMMANDS)[number]

export const MODES = ['Auto', 'Manual', 'Maintenance'] as const
export type PackMode = (typeof MODES)[number]

/** state + mode as the runtime sends it: evt { ev: 'machine', state, mode } */
export interface MachineStatus {
  state: PackState
  mode: PackMode
  /** step 34: CRC of the program the runtime has loaded (null = none); the canvas glows only when it is the canvas's own */
  prog?: string | null
}

export const isActing = (s: PackState): s is ActingState => s in ACTING

/** command in a state → the acting state it starts (PackML transitions of the design) */
const TABLE: Record<PackCommand, Partial<Record<PackState, ActingState>>> = {
  start: { IDLE: 'STARTING', HELD: 'UNHOLDING' }, // Start on a held machine = Unhold
  hold: { EXECUTE: 'HOLDING' },
  reset: { STOPPED: 'RESETTING', COMPLETE: 'RESETTING', ABORTED: 'CLEARING' }, // Reset on Aborted = Clear
  stop: {}
}
const NO_STOP: readonly PackState[] = ['STOPPED', 'STOPPING', 'ABORTING', 'ABORTED', 'CLEARING']

/** where a command is possible, for the message: start → 'IDLE or HELD' */
const WHERE: Record<PackCommand, string> = {
  start: 'IDLE or HELD',
  hold: 'EXECUTE',
  reset: 'STOPPED, COMPLETE or ABORTED',
  stop: 'any state except STOPPED and the abort group'
}

export type CommandResult = { ok: true; next: ActingState } | { ok: false; reason: string }

export function command(state: PackState, cmd: PackCommand): CommandResult {
  const next = cmd === 'stop' ? (NO_STOP.includes(state) ? undefined : 'STOPPING') : TABLE[cmd][state]
  if (next) return { ok: true, next }
  const word = cmd[0]!.toUpperCase() + cmd.slice(1)
  return { ok: false, reason: `${word} is not possible in ${state} (only in ${WHERE[cmd]})` }
}

/** an acting state has finished → the wait state it leads to */
export const settle = (s: PackState): PackState => (isActing(s) ? ACTING[s] : s)

/** Abort (step 33): a P1 alarm or the E-stop — from every state except the abort group */
const NO_ABORT: readonly PackState[] = ['ABORTING', 'ABORTED', 'CLEARING']
export function abort(state: PackState): { ok: true; next: 'ABORTING' } | { ok: false; reason: string } {
  return NO_ABORT.includes(state) ? { ok: false, reason: `already ${state}` } : { ok: true, next: 'ABORTING' }
}

/** the mode may change only while the machine stands (PackML: in a wait state where nothing moves) */
const MODE_STATES: readonly PackState[] = ['STOPPED', 'IDLE', 'ABORTED']
export function changeMode(state: PackState, mode: PackMode): { ok: true } | { ok: false; reason: string } {
  if (!MODES.includes(mode)) return { ok: false, reason: `unknown mode '${String(mode)}'` }
  return MODE_STATES.includes(state)
    ? { ok: true }
    : { ok: false, reason: `the mode can change only in STOPPED, IDLE or ABORTED (now ${state})` }
}
