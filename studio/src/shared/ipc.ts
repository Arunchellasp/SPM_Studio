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
  menuCommand: 'menu:command', // main → renderer (push): File menu item clicked
  projectExport: 'project:export', // renderer → main (invoke): save dialog, write .xlsx / .csv (step 22)
  projectImport: 'project:import', // renderer → main (invoke): open dialog, read .xlsx / .csv → tags (step 22)
  projectSaveProgram: 'project:save-program', // renderer → main (invoke): check + write program.json (step 27)
  projectBuild: 'project:build' // renderer → main (invoke): compile the saved program → program.rt.json, optionally download (step 34)
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

/**
 * Link timing (step 31), shared by the bridge (main) and the browser simulator, so both behave alike.
 * A stopped runtime closes the socket → OFFLINE at once; a hung one stops answering pings →
 * OFFLINE when no pong came for STALE_MS, checked every WATCHDOG_MS: at most 2.75 s, inside the 3 s the roadmap asks.
 */
export const LINK = {
  PING_MS: 1000,
  WATCHDOG_MS: 250,
  STALE_MS: 2500,
  BACKOFF_MIN_MS: 500,
  BACKOFF_MAX_MS: 5000
} as const

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

/** tags.json types are GENERATED from schemas/tags.schema.json (step 17: npm run gen) — never typed twice */
import type { Tag, TagFile } from './generated/tags'
export type { Addr, Pair, Role, Tag, TagFile } from './generated/tags'
/** program.json types, GENERATED from schemas/program.schema.json (step 27) */
import type { ProgramFile } from './generated/program'
export type { ProgramFile, Flow as ProgramFlow, Node as ProgramNode, Edge as ProgramEdge } from './generated/program'
/** the twelve kinds, read from the generated type: a new kind in the schema appears here by itself */
export type TagKind = Tag['kind']

export interface ProjectInfo {
  /** folder name, e.g. 'demo' (config.json may give a nicer name later) */
  name: string
  /** absolute folder path on this PC (shown only, never sent back by the screens) */
  dir: string
  tags: TagFile
  /** step 27: the project's flowcharts; null / missing = no program.json yet (a new project) */
  program?: ProgramFile | null
}

/** cancelled = the user closed the folder dialog; errors = why the folder could not be opened */
/** step 34: result of Build / Download — the compiled step table (the canvas maps the live pc to nodes with it) */
export type BuildResult =
  | { ok: true; rt: import('./generated/rt').RtFile; file: string; downloaded: boolean }
  | { ok: false; stage: 'project' | 'compile' | 'download'; errors: string[] }

export type ProjectOpenResult = { ok: true; project: ProjectInfo } | { ok: false; cancelled?: boolean; errors: string[] }

/** changed = false: the file on disk was already exactly this (nothing written) */
export type ProjectSaveResult = { ok: true; changed: boolean; file: string } | { ok: false; errors: string[] }

/** step 22: Excel / CSV */
export type ProjectExportResult = { ok: true; file: string } | { ok: false; cancelled?: boolean; errors: string[] }
/** errors = rows that could not be read (the others are in tags) */
export type ProjectImportResult =
  { ok: true; file: string; tags: Tag[]; errors: string[] } | { ok: false; cancelled?: boolean; errors: string[] }

/** File menu items forwarded to the screens */
export type MenuCommand = 'project.open' | 'project.save' | 'project.import' | 'project.export'

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
    /** step 22: write the given tags to an .xlsx / .csv the user picks */
    exportTags(tags: Tag[]): Promise<ProjectExportResult>
    /** step 22: read an .xlsx / .csv the user picks; the screens decide what to do with the rows */
    importTags(): Promise<ProjectImportResult>
    /** step 27: writes program.json of the project opened last; refused when the schema check fails */
    saveProgram(program: ProgramFile): Promise<ProjectSaveResult>
    /**
     * step 34: compile the SAVED program.json + tags.json of the open project, write program.rt.json;
     * download = also send it to the runtime (only in STOPPED; the runtime checks schema and CRC)
     */
    build(download: boolean): Promise<BuildResult>
  }
  /** File menu (Ctrl+O, Ctrl+S) */
  onMenu(cb: (cmd: MenuCommand) => void): () => void
}
