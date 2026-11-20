/**
 * N01 Operate › Overview model (step 11). Raw values with units as numbers;
 * formatting ("4.85 s", "98.9 %", "TRUE") is the job of the view, not of the data.
 */
import type { Alarm, MachineEvent, MachineState, ValueState } from './machine'

export interface Batch {
  id: string // A-12
  product: string // Trim dispensing
  partsDone: number
  partsTarget: number
  cycleTimeS: number // last cycle, seconds
  cycleTargetS: number
  yieldPct: number
  oeePct: number
  next: { text: string; inParts: number } // "Next: tray change in 6 parts"
}

/** "Why not faster?" — the biggest time loss, from trace analysis */
export interface WhyNotFaster {
  station: string
  waitsFor: string
  waitS: number // per part
  sharePct: number // share of the cycle
  suggestion: string
  source: string
}

/** one row of a station card's signal table */
export interface Signal {
  name: string
  value: boolean | number | string // TRUE / 1.24 / 'ON'
  unit?: string // 's' …
  limit?: number // e.g. step timeout: shown as "12.4 s / 15 s"
  state?: ValueState // default normal
  note?: string // short hint shown next to the value: 'blocks step', 'timeout soon'
}

export interface Station {
  id: string
  title: string // "Station 1 · Load", "Robot SCARA"
  state: MachineState
  step: { id: string; text: string; elapsedS?: number }
  signals: Signal[]
}

export interface OverviewData {
  batch: Batch
  whyNotFaster: WhyNotFaster
  stations: Station[]
  alarms: Alarm[]
  events: MachineEvent[]
}
