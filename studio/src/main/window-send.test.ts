import { describe, expect, it, vi } from 'vitest'
import { sendTo, type WindowLike } from './window-send'

const fakeWin = (destroyed: boolean): WindowLike & { sent: ReturnType<typeof vi.fn> } => {
  const sent = vi.fn(() => {
    if (destroyed) throw new TypeError('Object has been destroyed') // what Electron does
  })
  return { isDestroyed: () => destroyed, webContents: { isDestroyed: () => destroyed, send: sent }, sent }
}

describe('sending to the window (step 33)', () => {
  it('U-33.10 sends to a live window; a destroyed one (quit) or none is skipped, no error', () => {
    const live = fakeWin(false)
    expect(sendTo(live, 'runtime:status', { link: 'offline' })).toBe(true)
    expect(live.sent).toHaveBeenCalledWith('runtime:status', { link: 'offline' })
    const gone = fakeWin(true)
    expect(() => sendTo(gone, 'runtime:status', { link: 'offline' })).not.toThrow()
    expect(gone.sent).not.toHaveBeenCalled()
    expect(sendTo(null, 'runtime:status', {})).toBe(false)
  })
})
