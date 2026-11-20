/**
 * Sample data (step 11): the ONE fake data source for every static screen.
 * Values are copied from the Improved design N01 Operate › Overview, so the built screens
 * can be compared 1:1 with the template. Screens import from here; they never type data in.
 * When the runtime is connected (phase G) the same types are filled from live data instead.
 */
import type { CellInfo } from '../model/machine'
import type { OverviewData, Signal } from '../model/overview'

export const DEMO_CELL = {
  name: 'Line 3 · Trim dispensing cell',
  user: 'A. Engineer',
  state: 'EXECUTE',
  mode: 'Auto'
} satisfies CellInfo

/** the three signals most station cards show */
const usual = (stepTimeS: number): Signal[] => [
  { name: 'Part present', value: true },
  { name: 'Clamp forward', value: true },
  { name: 'Step time', value: stepTimeS, unit: 's' }
]

export const DEMO_OVERVIEW = {
  batch: {
    id: 'A-12',
    product: 'Trim dispensing',
    partsDone: 4,
    partsTarget: 50,
    cycleTimeS: 4.85,
    cycleTargetS: 4.5,
    yieldPct: 98.9,
    oeePct: 80.5,
    next: { text: 'tray change', inParts: 6 }
  },
  whyNotFaster: {
    station: 'Station 2',
    waitsFor: 'robot',
    waitS: 1.7,
    sharePct: 35,
    suggestion: 'dual gripper',
    source: 'trace analysis'
  },
  stations: [
    { id: 'st1', title: 'Station 1 · Load', state: 'EXECUTE', step: { id: 's5', text: 'Wait part present' }, signals: usual(1.24) },
    {
      id: 'st2',
      title: 'Station 2 · Plasma clean',
      state: 'HELD',
      step: { id: 's3', text: 'Wait plasma ready', elapsedS: 12.4 },
      signals: [
        { name: 'Plasma ready', value: false, note: 'blocks step' },
        { name: 'Plasma power', value: 'ON' },
        { name: 'Step time', value: 12.4, unit: 's', limit: 15, note: 'timeout soon' }
      ]
    },
    { id: 'st3', title: 'Station 3 · Dispense', state: 'EXECUTE', step: { id: 's7', text: 'Dispense path 2/4' }, signals: usual(1.24) },
    { id: 'st4', title: 'Station 4 · Unload', state: 'IDLE', step: { id: 's0', text: 'Idle' }, signals: usual(1.24) },
    { id: 'robot', title: 'Robot SCARA', state: 'EXECUTE', step: { id: 'r4', text: 'Place fixture' }, signals: usual(1.24) },
    { id: 'conveyor', title: 'Conveyor', state: 'EXECUTE', step: { id: 'c1', text: 'Index' }, signals: usual(1.24) }
  ],
  alarms: [
    { code: 'E1202', text: 'Plasma ready signal lost during cleaning (station 2)', priority: 1, time: '12:37:51', acked: false },
    { code: 'W0310', text: 'Glue level below 20 % (station 3)', priority: 3, time: '12:31:02', acked: true }
  ],
  events: [{ time: '12:30:00', text: 'Batch A-12 started by A. Engineer' }]
} satisfies OverviewData
