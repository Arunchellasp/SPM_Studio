/**
 * How tags.json is written (Software implementation › 3c step 7): sorted by name,
 * pretty-printed with 2 spaces, one newline at the end → a Git diff shows exactly which tag changed.
 * Pure functions: used by the main process (real file) and the browser stand-in (tests).
 */
import type { TagFile } from './ipc'

/** a copy with the tags sorted by name (A–Z, the same order on every PC) */
export function sortTags(file: TagFile): TagFile {
  const tags = [...file.tags].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return { ...file, tags }
}

/** the exact text written to disk; eol '\r\n' only if the existing file used it */
export function formatTagFile(file: TagFile, eol: '\n' | '\r\n' = '\n'): string {
  const text = JSON.stringify(sortTags(file), null, 2) + '\n'
  return eol === '\n' ? text : text.replace(/\n/g, '\r\n')
}

/** tag count per kind, in the order of the schema's kind list (for the N03 summary) */
export const TAG_KINDS = ['DI', 'DO', 'AI', 'AO', 'AXIS', 'POINT', 'REG', 'TIMER', 'COUNTER', 'ALARM', 'RECIPE', 'UDT'] as const

export function countByKind(file: TagFile): { kind: string; count: number }[] {
  return TAG_KINDS.map((kind) => ({ kind, count: file.tags.filter((t) => t.kind === kind).length })).filter((r) => r.count > 0)
}
