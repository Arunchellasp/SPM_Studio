/**
 * Project store (main process): read and write the files of one project folder.
 * Plain Node (fs) — no Electron here, so it is unit-tested in a temp folder.
 *
 *   projects/demo/
 *     tags.json        ← this step
 *     tags.json.bak    ← the previous version, written by save (one level of undo on disk)
 *     program.json     ← step 27: the flowcharts (optional — a new project has none yet), .bak the same way
 *     config.json … later steps
 *
 * Rules: read → check against schemas/tags.schema.json; save → schema + tags-rules first, refuse a bad file,
 * write a temp file and rename it over the old one (a crash never leaves half a tags.json).
 */
import { copyFile, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import tagsSchema from '../../../../schemas/tags.schema.json'
import programSchema from '../../../../schemas/program.schema.json'
import type { ProgramFile, ProjectOpenResult, ProjectSaveResult, TagFile } from '@shared/ipc'
import { formatProgramFile } from '@shared/program-file'
import { makeTagChecker } from '@shared/tags-schema'
import { formatTagFile } from '@shared/tags-file'
import { checkTags, issueText } from '@shared/tags-rules'

export const TAGS_FILE = 'tags.json'
export const PROGRAM_FILE = 'program.json'
export const BACKUP_SUFFIX = '.bak'

const checkSchema = makeTagChecker(tagsSchema)
const checkProgram = makeTagChecker(programSchema)

/** the first lines of the checker's list are enough for a toast; the rest is counted */
const MAX_ERRORS = 10

function short(errors: string[]): string[] {
  return errors.length <= MAX_ERRORS ? errors : [...errors.slice(0, MAX_ERRORS), `… and ${errors.length - MAX_ERRORS} more`]
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Read and check <dir>/tags.json. A file that fails the schema is not opened (the reasons are returned). */
export async function openProject(dir: string): Promise<ProjectOpenResult> {
  const file = join(dir, TAGS_FILE)
  if (!(await exists(file))) return { ok: false, errors: [`no ${TAGS_FILE} in ${dir} — is this a project folder?`] }
  let data: unknown
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    return { ok: false, errors: [`${TAGS_FILE} is not valid JSON: ${(e as Error).message}`] }
  }
  const check = checkSchema(data)
  if (!check.ok) return { ok: false, errors: short(check.errors) }
  // step 27: program.json next to it — optional; when present it must pass its schema too
  const prog = join(dir, PROGRAM_FILE)
  let program: ProgramFile | null = null
  if (await exists(prog)) {
    let p: unknown
    try {
      p = JSON.parse(await readFile(prog, 'utf8'))
    } catch (e) {
      return { ok: false, errors: [`${PROGRAM_FILE} is not valid JSON: ${(e as Error).message}`] }
    }
    const pc = checkProgram(p)
    if (!pc.ok) return { ok: false, errors: short(pc.errors.map((x) => `${PROGRAM_FILE} › ${x}`)) }
    program = p as ProgramFile
  }
  // rule problems do NOT block opening: the file opens, N03 shows them red so they can be fixed (step 20);
  // flow problems the same way: N02 shows badges (step 26)
  return { ok: true, project: { name: basename(dir), dir, tags: data as TagFile, program } }
}

/**
 * Write text to a file safely: keep the old one as .bak, write a temp file, rename it over the old one
 * (a crash never leaves half a file). Nothing is written when the text is already exactly what is there.
 */
async function writeSafely(file: string, make: (eol: '\n' | '\r\n') => string): Promise<ProjectSaveResult> {
  const old = (await exists(file)) ? await readFile(file, 'utf8') : null
  const text = make(old?.includes('\r\n') ? '\r\n' : '\n')
  if (old === text) return { ok: true, changed: false, file } // nothing to do: no write, no backup
  try {
    if (old !== null) await copyFile(file, file + BACKUP_SUFFIX)
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, text, 'utf8')
    await rename(tmp, file) // replaces the old file in one go (also on Windows)
  } catch (e) {
    return { ok: false, errors: [`could not write ${file}: ${(e as Error).message}`] }
  }
  return { ok: true, changed: true, file }
}

/** step 27: check, then write <dir>/program.json. Flow problems (badges) do not block saving — only the schema does. */
export async function saveProgram(dir: string, program: ProgramFile): Promise<ProjectSaveResult> {
  const check = checkProgram(program)
  if (!check.ok) return { ok: false, errors: short(check.errors) }
  return writeSafely(join(dir, PROGRAM_FILE), (eol) => formatProgramFile(program, eol))
}

/** Check, then write <dir>/tags.json (sorted, 2-space JSON). Keeps the file's line endings. */
export async function saveTags(dir: string, tags: TagFile): Promise<ProjectSaveResult> {
  const check = checkSchema(tags)
  if (!check.ok) return { ok: false, errors: short(check.errors) }
  // step 20: rules across tags (duplicate name, address used twice, min ≥ max …) — the screens check too,
  // but main is the last gate before the disk
  const issues = checkTags(tags.tags)
  if (issues.length) return { ok: false, errors: short(issues.map(issueText)) }

  return writeSafely(join(dir, TAGS_FILE), (eol) => formatTagFile(tags, eol))
}
