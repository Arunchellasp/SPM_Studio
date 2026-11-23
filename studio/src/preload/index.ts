/**
 * Preload: the only bridge between screens and the main process.
 * Exposes a small typed API (window.spm); no Node.js objects leak to the page.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type StudioApi } from '@shared/ipc'

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, v: T): void => cb(v)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: StudioApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  runtime: {
    command: (op, args) => ipcRenderer.invoke(IPC.runtimeCommand, { op, args }),
    onStatus: (cb) => subscribe(IPC.runtimeStatus, cb),
    onState: (cb) => subscribe(IPC.runtimeState, cb),
    onEvent: (cb) => subscribe(IPC.runtimeEvent, cb)
  },
  project: {
    open: () => ipcRenderer.invoke(IPC.projectOpen),
    save: (tags) => ipcRenderer.invoke(IPC.projectSave, tags),
    exportTags: (tags) => ipcRenderer.invoke(IPC.projectExport, tags),
    importTags: () => ipcRenderer.invoke(IPC.projectImport)
  },
  onMenu: (cb) => subscribe(IPC.menuCommand, cb)
}

contextBridge.exposeInMainWorld('spm', api)
