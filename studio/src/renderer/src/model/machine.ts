/**
 * Machine model (step 11): the words every screen, store and (later) the runtime protocol share.
 * Types only — no values. The values come from fixtures/ today and from the C runtime later.
 */

/** PackML machine state (N00 › Machine state pill) */
export type MachineState = 'STOPPED' | 'IDLE' | 'STARTING' | 'EXECUTE' | 'HELD' | 'SUSPENDED' | 'ABORTED' | 'COMPLETE'
export type Mode = 'Auto' | 'Manual' | 'Maintenance'
/** alarm priority P1 (critical) … P4 (low), ISA-18.2 */
export type Priority = 1 | 2 | 3 | 4
/** how a value is shown (N00 › Value states): colour only when a person must look */
export type ValueState = 'normal' | 'forced' | 'fault'

export interface Alarm {
  code: string // E1202 (error) / W0310 (warning)
  text: string
  priority: Priority
  time: string // hh:mm:ss, local machine time
  acked: boolean
}

/** a line in the event list (not an alarm: nothing to acknowledge) */
export interface MachineEvent {
  time: string
  text: string
}

/** the cell this HMI belongs to and who is logged in */
export interface CellInfo {
  name: string
  user: string
  state: MachineState
  mode: Mode
}
