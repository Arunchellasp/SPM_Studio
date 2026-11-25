/// <reference types="vite/client" />
import type { StudioApi } from '@shared/ipc'
import type { SimRuntimeControl } from './dev/sim-api'

declare global {
  interface Window {
    spm: StudioApi
    /** browser simulator only (no Electron): stop / hang / start its runtime — step 31 */
    spmSim?: SimRuntimeControl
  }
}

export {}
