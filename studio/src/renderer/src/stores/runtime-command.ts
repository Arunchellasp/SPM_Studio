/**
 * Step 32 · send a command to the runtime (through the preload API) and show a refusal as a toast.
 * The screens never change the machine state themselves: the runtime answers with evt 'machine'.
 */
import type { CommandResult } from '@shared/ipc'
import { toast } from './feedback.store'

export async function runtimeCommand(op: string, args: Record<string, unknown> = {}): Promise<CommandResult> {
  const r: CommandResult = globalThis.window?.spm // no window in unit tests
    ? await window.spm.runtime.command(op, args)
    : { ok: false, err: 'OFFLINE', msg: 'runtime not connected' }
  if (!r.ok)
    toast(`${op === 'mode' ? 'Mode' : op[0]!.toUpperCase() + op.slice(1)} refused: ${r.msg ?? r.err ?? 'no reason given'}`, 'error')
  return r
}
