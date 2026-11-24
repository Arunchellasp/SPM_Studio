/**
 * How program.json is written (step 27): 2-space JSON like tags.json, but short arrays of plain values
 * (a node's pos, a link) stay on one line — "pos": [400, 140], ["n6", "n7", "no"] — so the file reads like the
 * design (Software implementation › 4c) and a Git diff shows exactly which node moved or which link changed.
 * Flows keep their order (the tree's order); nodes and links keep the order they were drawn in.
 * Pure: used by the main process (real file) and the browser stand-in (tests).
 */
import type { ProgramFile } from './ipc'

export const PROGRAM_SCHEMA = 'spm.program/1'

/** an empty program (a project without program.json) */
export const emptyProgram = (): ProgramFile => ({ schema: PROGRAM_SCHEMA, flows: [] })

/** the exact text written to disk; eol '\r\n' only if the existing file used it */
export function formatProgramFile(file: ProgramFile, eol: '\n' | '\r\n' = '\n'): string {
  const pretty = JSON.stringify(file, null, 2)
  // [\n  1,\n  2\n] → [1, 2]   (only arrays whose items are numbers / strings, never objects)
  const text =
    pretty.replace(
      /\[\n\s+((?:-?[\d.e+-]+|"(?:[^"\\]|\\.)*")(?:,\n\s+(?:-?[\d.e+-]+|"(?:[^"\\]|\\.)*"))*)\n\s*\]/g,
      (_m, items: string) => `[${items.split(/,\n\s+/).join(', ')}]`
    ) + '\n'
  return eol === '\n' ? text : text.replace(/\n/g, '\r\n')
}
