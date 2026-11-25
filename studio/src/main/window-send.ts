/**
 * Send to the window only while it exists (step 33, found on the PC): on quit the bridge closes its
 * socket and reports 'offline' after the window is already destroyed — webContents.send then threw
 * "Object has been destroyed" as an error dialog in the main process.
 */
export interface WindowLike {
  isDestroyed(): boolean
  webContents: { isDestroyed(): boolean; send(channel: string, ...args: unknown[]): void }
}

/** true = sent; false = no window (yet / any more): nothing to do */
export function sendTo(win: WindowLike | null, channel: string, payload: unknown): boolean {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return false
  win.webContents.send(channel, payload)
  return true
}
