/**
 * UI store: the state every shell element reads (one place, no prop drilling).
 * Step 1 = local placeholder values only. In a later step the machine state,
 * mode and alarms come from the C runtime instead of these defaults.
 * Types: model/machine.ts · sample values: fixtures/demo.ts (step 11).
 */
import { create } from 'zustand'
import { applyTheme, loadTheme, saveTheme, type Theme } from '../app/theme'
import { DEMO_CELL } from '../fixtures/demo'
import type { Alarm, MachineState, Mode } from '../model/machine'

interface UiState {
  // shell context
  cellName: string
  userName: string
  activeScreen: string
  // machine (placeholders until the runtime is connected)
  machineState: MachineState
  mode: Mode
  alarms: Alarm[]
  // display (step 10): saved on this PC
  theme: Theme
  // actions
  openScreen: (id: string) => void
  setMode: (m: Mode) => void
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
  alarms: [],
  theme: loadTheme(), // what was chosen last time on this PC (default light)

  openScreen: (id) => set({ activeScreen: id }),
  setMode: (mode) => set({ mode }),
  ackTopAlarm: () => set((s) => ({ alarms: s.alarms.map((a, i) => (i === 0 ? { ...a, acked: true } : a)) })),
  setTheme: (theme) => {
    applyTheme(theme)
    saveTheme(theme)
    set({ theme })
  }
}))
