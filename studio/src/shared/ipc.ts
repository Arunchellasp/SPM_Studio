/**
 * The only place IPC channel names and payload shapes are defined.
 * main, preload and renderer all import from here, so a rename is one edit.
 */

export const IPC = {
  appInfo: 'app:info',
  runtimeStatus: 'runtime:status', // main → renderer (push)
  runtimeState: 'runtime:state', // main → renderer (push)
  runtimeEvent: 'runtime:event', // main → renderer (push)
  runtimeCommand: 'runtime:command' // renderer → main (invoke)
} as const

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
}

export type LinkState = 'connecting' | 'online' | 'offline'

export interface RuntimeStatus {
  link: LinkState
  url: string
  runtimeVersion?: string
  cycleUs?: number
  cycleMaxUs?: number
  lastError?: string
}

/** Merged live values: tag id (string) → value */
export type TagValues = Record<string, number | boolean | string>

export interface RuntimeState {
  seq: number
  values: TagValues
  /** flow id → current step index */
  pc: Record<string, number>
}

export interface RuntimeEvent {
  ev: string
  ts: number
  [key: string]: unknown
}

export interface CommandResult {
  ok: boolean
  err?: string
  msg?: string
  [key: string]: unknown
}

/** The typed API exposed to the screens by the preload script. */
export interface StudioApi {
  appInfo(): Promise<AppInfo>
  runtime: {
    command(op: string, args?: Record<string, unknown>): Promise<CommandResult>
    onStatus(cb: (s: RuntimeStatus) => void): () => void
    onState(cb: (s: RuntimeState) => void): () => void
    onEvent(cb: (e: RuntimeEvent) => void): () => void
  }
}
