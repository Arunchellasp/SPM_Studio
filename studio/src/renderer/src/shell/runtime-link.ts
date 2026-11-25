/**
 * Step 31 · what the header shows for the runtime link (pure, unit-tested).
 * online: green dot + cycle time · connecting (first try only): amber · offline: red OFFLINE.
 * The tooltip has the details: address, runtime version, max cycle, last error.
 */
import type { LinkState, RuntimeStatus } from '@shared/ipc'

export interface LinkView {
  tone: LinkState
  text: string
  title: string
}

const US_PER_MS = 1000
/** 1000 µs → '1.00 ms' */
export const ms = (us: number): string => `${(us / US_PER_MS).toFixed(2)} ms`

export function linkView(s: RuntimeStatus): LinkView {
  const at = s.url ? ` at ${s.url}` : ''
  if (s.link === 'online') {
    const lines = [`Runtime online${at}`]
    if (s.runtimeVersion) lines.push(`version ${s.runtimeVersion}`)
    if (s.cycleUs !== undefined) lines.push(`cycle ${ms(s.cycleUs)}${s.cycleMaxUs !== undefined ? ` · max ${ms(s.cycleMaxUs)}` : ''}`)
    return { tone: 'online', text: s.cycleUs !== undefined ? `Online · ${ms(s.cycleUs)}` : 'Online', title: lines.join('\n') }
  }
  if (s.link === 'connecting') return { tone: 'connecting', text: 'Connecting…', title: `Connecting to the runtime${at}` }
  const lines = [`No runtime${at} — retrying`]
  if (s.lastError) lines.push(s.lastError)
  return { tone: 'offline', text: 'OFFLINE', title: lines.join('\n') }
}
