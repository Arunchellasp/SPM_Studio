/**
 * UI store: the state every shell element reads (one place, no prop drilling).
 * Step 1 = local placeholder values only. In a later step the machine state,
 * mode and alarms come from the C runtime instead of these defaults.
 * Types: model/machine.ts · sample values: fixtures/demo.ts (step 11).
 * Step 14: alarms and events start from the sample data; Ack writes an event.
 */
import { create } from 'zustand'
import { applyTheme, loadTheme, saveTheme, type Theme } from '../app/theme'
import { DEMO_CELL, DEMO_OVERVIEW } from '../fixtures/demo'
import { clockText, sortAlarms, topAlarm } from '../features/alarms/alarms'
import type { Alarm, MachineEvent, MachineState, Mode } from '../model/machine'

interface UiState {
  // shell context
  cellName: string
  userName: string
  activeScreen: string
  // machine (placeholders until the runtime is connected)
  machineState: MachineState
  mode: Mode
  alarms: Alarm[] // always sorted: priority, then newest first
  events: MachineEvent[] // newest first
  // display (step 10): saved on this PC
  theme: Theme
  // actions
  openScreen: (id: string) => void
  setMode: (m: Mode) => void
  ackAlarm: (code: string) => void
  ackTopAlarm: () => void
  setTheme: (t: Theme) => void
}

export const useUi = create<UiState>((set) => ({
  cellName: DEMO_CELL.name, // from the sample data (step 11), later from the project file
  userName: DEMO_CELL.user,
  // a plain id, not SCREENS[0].id: screens.ts imports screen views that use this store,
  // so importing screens.ts here would be a circle (found in step 10)
  activeScreen: 'operate',

  machineState: 'STOPPED',
  mode: 'Auto',
  alarms: sortAlarms(DEMO_OVERVIEW.alarms),
  events: [...DEMO_OVERVIEW.events],
  theme: loadTheme(), // what was chosen last time on this PC (default light)

  openScreen: (id) => set({ activeScreen: id }),
  setMode: (mode) => set({ mode }),
  ackAlarm: (code) =>
    set((s) => {
      const a = s.alarms.find((x) => x.code === code)
      if (!a || a.acked) return {} // nothing to do (unknown or already acknowledged)
      return {
        alarms: s.alarms.map((x) => (x.code === code ? { ...x, acked: true } : x)),
        // every acknowledgement is recorded: who, what, when (audit trail starts here)
        events: [{ time: clockText(new Date()), text: `${code} acknowledged by ${s.userName}` }, ...s.events]
      }
    }),
  ackTopAlarm: () => {
    const top = topAlarm(useUi.getState().alarms)
    if (top) useUi.getState().ackAlarm(top.code)
  },
  setTheme: (theme) => {
    applyTheme(theme)
    saveTheme(theme)
    set({ theme })
  }
}))
