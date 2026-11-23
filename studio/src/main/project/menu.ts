/**
 * The window's File menu. The menu bar is hidden (autoHideMenuBar): Alt shows it,
 * Ctrl+O / Ctrl+S work without it. A click is forwarded to the screens, which own the
 * current tag table (and later: ask before discarding unsaved changes).
 */
import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { MenuCommand } from '@shared/ipc'

export function buildMenu(send: (cmd: MenuCommand) => void, dev: boolean): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        { label: '&Open project…', accelerator: 'CmdOrCtrl+O', click: () => send('project.open') },
        { label: '&Save', accelerator: 'CmdOrCtrl+S', click: () => send('project.save') },
        { type: 'separator' },
        { role: 'quit', label: 'E&xit' }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' }, // Ctrl+R: reload the screens (main and the machine keep running)
        ...(dev ? ([{ role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []), // Ctrl+Shift+I
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  return Menu.buildFromTemplate(template)
}
