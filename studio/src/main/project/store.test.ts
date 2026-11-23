// Step 16 — project store: read / write round trip in a temp folder (no Electron needed).
import { copyFile, mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TagFile } from '@shared/ipc'
import { BACKUP_SUFFIX, openProject, saveTags, TAGS_FILE } from './store'

const DEMO = resolve(__dirname, '../../../../projects/demo/tags.json')
let dir = ''
const file = (): string => join(dir, TAGS_FILE)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'spm-project-'))
  await copyFile(DEMO, file())
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function opened(): Promise<TagFile> {
  const r = await openProject(dir)
  if (!r.ok) throw new Error(r.errors.join('\n'))
  return r.project.tags
}

describe('project store', () => {
  it('U-16.1 opens the demo project: name = folder, 20 tags', async () => {
    const r = await openProject(dir)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.project.tags.tags).toHaveLength(20)
      expect(r.project.dir).toBe(dir)
      expect(r.project.name).toMatch(/^spm-project-/)
    }
  })

  it('U-16.2 saving what was opened changes nothing on disk (no write, no backup)', async () => {
    const before = await readFile(file(), 'utf8')
    const r = await saveTags(dir, await opened())
    expect(r).toEqual({ ok: true, changed: false, file: file() })
    expect(await readFile(file(), 'utf8')).toBe(before)
    expect(await readdir(dir)).toEqual([TAGS_FILE])
  })

  it('U-16.3 round trip: add a tag → saved sorted, old file kept as .bak, reopen gives 21 tags', async () => {
    const before = await readFile(file(), 'utf8')
    const tags = await opened()
    tags.tags.push({ name: 'DI_S2_PartPresent', kind: 'DI', dtype: 'BOOL', scope: 'S2', addr: { bus: 'ecat', slave: 3, ch: 9 } })
    const r = await saveTags(dir, tags)
    expect(r).toEqual({ ok: true, changed: true, file: file() })
    expect(await readFile(file() + BACKUP_SUFFIX, 'utf8')).toBe(before)
    const again = await opened()
    expect(again.tags).toHaveLength(21)
    const names = again.tags.map((t) => t.name)
    expect(names).toEqual([...names].sort())
    expect(names.indexOf('DI_S2_PartPresent')).toBe(names.indexOf('DI_S2_DoorClosed') + 1)
    expect((await readdir(dir)).sort()).toEqual([TAGS_FILE, TAGS_FILE + BACKUP_SUFFIX]) // no .tmp left behind
  })

  it('U-16.4 a file that fails the schema is NOT written; the reason is returned', async () => {
    const before = await readFile(file(), 'utf8')
    const tags = await opened()
    tags.tags[0]!.kind = 'DX'
    const r = await saveTags(dir, tags)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/^tag 0 'AI_Sealer_Temp' › kind: must be one of/)
    expect(await readFile(file(), 'utf8')).toBe(before)
  })

  it('U-16.5 Windows line endings (CRLF) in the file are kept', async () => {
    const crlf = (await readFile(file(), 'utf8')).replace(/\n/g, '\r\n')
    await writeFile(file(), crlf)
    expect(await saveTags(dir, await opened())).toMatchObject({ ok: true, changed: false })
    const tags = await opened()
    tags.tags.find((t) => t.name === 'R_S1_Step')!.desc = 'Station 1 step number'
    expect(await saveTags(dir, tags)).toMatchObject({ ok: true, changed: true })
    const text = await readFile(file(), 'utf8')
    expect(text.includes('\r\n')).toBe(true)
    expect(/[^\r]\n/.test(text)).toBe(false)
  })

  it('U-16.6 clear messages for a folder without tags.json, broken JSON, and a file that fails the schema', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'spm-empty-'))
    const r1 = await openProject(empty)
    await rm(empty, { recursive: true, force: true })
    expect(r1).toEqual({ ok: false, errors: [`no tags.json in ${empty} — is this a project folder?`] })

    await writeFile(file(), '{ "schema": "spm.tags/1", "tags": [ }')
    const r2 = await openProject(dir)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.errors[0]).toMatch(/^tags.json is not valid JSON: /)

    await writeFile(file(), JSON.stringify({ schema: 'spm.tags/2', tags: [] }))
    expect(await openProject(dir)).toEqual({ ok: false, errors: ['schema: must be "spm.tags/1"'] })
  })
})
