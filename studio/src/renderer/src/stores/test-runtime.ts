/**
 * Test helper (step 33): a runtime for component and store tests, without Electron.
 * Link online; cmd 'ack' answers like the runtime: an evt 'alarm' ack into the live store.
 * Only imported by *.test.ts(x).
 */
import { vi } from 'vitest'
import { clockText } from '@shared/alarms'
import type { CommandResult } from '@shared/ipc'
import { useLive } from './live.store'

export function fakeRuntime(): ReturnType<typeof vi.fn> {
  const command = vi.fn(async (op: string, args: Record<string, unknown> = {}): Promise<CommandResult> => {
    if (op === 'ack') {
      const ev = { ev: 'alarm', act: 'ack', code: String(args.code), time: clockText(new Date()), by: String(args.user), ts: Date.now() }
      useLive.setState((s) => ({ events: [ev, ...s.events] }))
    }
    return { ok: true }
  })
  // jsdom: window === globalThis, so a global 'spm' is window.spm; plain node: no window, stub one
  if (typeof window === 'undefined') vi.stubGlobal('window', { spm: { runtime: { command } } })
  else vi.stubGlobal('spm', { runtime: { command } })
  useLive.setState({ status: { link: 'online', url: 'test' } })
  return command
}
