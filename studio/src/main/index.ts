/**
 * Main process: windows, security settings, IPC handlers, runtime bridge.
 * No UI code here; no heavy work on this thread (use worker_threads).
 */
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron'
import { z } from 'zod'
import { IPC, type AppInfo, type ProjectOpenResult, type ProjectSaveResult, type TagFile } from '@shared/ipc'
import { RuntimeBridge } from './runtime/bridge'
import { openProject, saveTags } from './project/store'
import { buildMenu } from './project/menu'

const RUNTIME_URL = process.env.SPM_RUNTIME_URL ?? 'ws://127.0.0.1:7600'
const isDev = !app.isPackaged

// Machines / containers without a usable GPU (e.g. Codespaces): software rendering
if (process.env.SPM_DISABLE_GPU === '1') app.disableHardwareAcceleration()

let win: BrowserWindow | null = null
const bridge = new RuntimeBridge(RUNTIME_URL)
/** folder of the open project; only main knows it, so the screens can never write elsewhere */
let projectDir: string | null = null

// ---------------------------------------------------------------- single instance
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#1b2128',
    title: 'SPM Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => win?.show())

  // never open new windows; external http(s) links go to the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // never navigate away from the app
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (!(isDev && devUrl && url.startsWith(devUrl))) e.preventDefault()
  })
  // a crashed screen is reloaded; main and the machine keep running
  win.webContents.on('render-process-gone', (_e, d) => {
    console.error('renderer gone:', d.reason)
    if (d.reason !== 'clean-exit') win?.webContents.reload()
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // push current link status and state as soon as the screen is ready
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send(IPC.runtimeStatus, bridge.getStatus())
    win?.webContents.send(IPC.runtimeState, bridge.getState())
  })
}

// ---------------------------------------------------------------- IPC
/** Only accept IPC from our own window's main frame. */
function trusted(e: Electron.IpcMainInvokeEvent): boolean {
  return !!win && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame
}

// a light shape check before the real one (Ajv + tags.schema.json in project/store.ts)
const SaveArgs = z.object({ schema: z.string(), tags: z.array(z.object({ name: z.string(), kind: z.string() }).loose()) })

const CommandArgs = z.object({
  op: z.string().regex(/^[a-z_]{1,32}$/),
  args: z.record(z.string(), z.unknown()).optional()
})

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, (e): AppInfo | null => {
    if (!trusted(e)) return null
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform
    }
  })

  ipcMain.handle(IPC.runtimeCommand, async (e, payload: unknown) => {
    if (!trusted(e)) return { ok: false, err: 'DENIED' }
    const p = CommandArgs.safeParse(payload)
    if (!p.success) return { ok: false, err: 'BAD_REQUEST', msg: p.error.issues[0]?.message }
    return bridge.command(p.data.op, p.data.args)
  })

  ipcMain.handle(IPC.projectOpen, async (e): Promise<ProjectOpenResult> => {
    if (!trusted(e) || !win) return { ok: false, errors: ['DENIED'] }
    const pick = await dialog.showOpenDialog(win, {
      title: 'Open project folder',
      properties: ['openDirectory'],
      defaultPath: projectDir ?? app.getPath('documents')
    })
    const dir = pick.filePaths[0]
    if (pick.canceled || !dir) return { ok: false, cancelled: true, errors: [] }
    const res = await openProject(dir)
    if (res.ok) projectDir = dir
    return res
  })

  ipcMain.handle(IPC.projectSave, async (e, payload: unknown): Promise<ProjectSaveResult> => {
    if (!trusted(e)) return { ok: false, errors: ['DENIED'] }
    if (!projectDir) return { ok: false, errors: ['no project is open'] }
    const p = SaveArgs.safeParse(payload)
    if (!p.success) return { ok: false, errors: ['BAD_REQUEST: ' + (p.error.issues[0]?.message ?? '')] }
    return saveTags(projectDir, p.data as TagFile)
  })

  bridge.on('status', (s) => win?.webContents.send(IPC.runtimeStatus, s))
  bridge.on('state', (s) => win?.webContents.send(IPC.runtimeState, s))
  bridge.on('event', (ev) => win?.webContents.send(IPC.runtimeEvent, ev))
}

// ---------------------------------------------------------------- lifecycle
app.whenReady().then(() => {
  // deny every permission request (camera, notifications, …) by default
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  registerIpc()
  Menu.setApplicationMenu(buildMenu((cmd) => win?.webContents.send(IPC.menuCommand, cmd), isDev))
  createWindow()
  bridge.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => bridge.stop())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
