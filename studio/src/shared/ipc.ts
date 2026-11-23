/**
 * The only place IPC channel names and payload shapes are defined.
 * main, preload and renderer all import from here, so a rename is one edit.
 */

export const IPC = {
  appInfo: 'app:info',
  runtimeStatus: 'runtime:status', // main → renderer (push)
  runtimeState: 'runtime:state', // main → renderer (push)
  runtimeEvent: 'runtime:event', // main → renderer (push)
  runtimeCommand: 'runtime:command', // renderer → main (invoke)
  projectOpen: 'project:open', // renderer → main (invoke): folder dialog, read + check tags.json
  projectSave: 'project:save', // renderer → main (invoke): check + write tags.json of the open project
  menuCommand: 'menu:command' // main → renderer (push): File menu item clicked
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

/** One row of tags.json. Columns are checked by schemas/tags.schema.json (step 15); typed fully in step 17. */
export interface TagRow {
  name: string
  kind: string
  [column: string]: unknown
}

/** The whole tags.json file */
export interface TagFile {
  schema: 'spm.tags/1'
  tags: TagRow[]
}

export interface ProjectInfo {
  /** folder name, e.g. 'demo' (config.json may give a nicer name later) */
  name: string
  /** absolute folder path on this PC (shown only, never sent back by the screens) */
  dir: string
  tags: TagFile
}

/** cancelled = the user closed the folder dialog; errors = why the folder could not be opened */
export type ProjectOpenResult = { ok: true; project: ProjectInfo } | { ok: false; cancelled?: boolean; errors: string[] }

/** changed = false: the file on disk was already exactly this (nothing written) */
export type ProjectSaveResult = { ok: true; changed: boolean; file: string } | { ok: false; errors: string[] }

/** File menu items forwarded to the screens */
export type MenuCommand = 'project.open' | 'project.save'

/** The typed API exposed to the screens by the preload script. */
export interface StudioApi {
  appInfo(): Promise<AppInfo>
  runtime: {
    command(op: string, args?: Record<string, unknown>): Promise<CommandResult>
    onStatus(cb: (s: RuntimeStatus) => void): () => void
    onState(cb: (s: RuntimeState) => void): () => void
    onEvent(cb: (e: RuntimeEvent) => void): () => void
  }
  project: {
    /** main shows the folder dialog; the screens never pass a path */
    open(): Promise<ProjectOpenResult>
    /** writes tags.json of the project opened last; refused when the schema check fails */
    save(tags: TagFile): Promise<ProjectSaveResult>
  }
  /** File menu (Ctrl+O, Ctrl+S) */
  onMenu(cb: (cmd: MenuCommand) => void): () => void
}
