// Step 27 — program.json next to tags.json: open / save round trip in a temp folder (no Electron needed).
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProgramFile } from '@shared/ipc'
import { BACKUP_SUFFIX, openProject, PROGRAM_FILE, saveProgram, TAGS_FILE } from './store'

const DEMO = resolve(__dirname, '../../../../projects/demo/tags.json')
let dir = ''
const prog = (): string => join(dir, PROGRAM_FILE)

const PROGRAM: ProgramFile = {
  schema: 'spm.program/1',
  flows: [
    {
      name: 'S1_Main',
      station: 'S1',
      autostart: false,
      nodes: [
        { id: 'start', type: 'start', pos: [0, 0] },
        { id: 'n1', type: 'if', pos: [0, 96], p: { expr: 'R_PartCount >= 100' } },
        { id: 'end', type: 'end', pos: [0, 240] }
      ],
      edges: [
        ['start', 'n1'],
        ['n1', 'end', 'yes'],
        ['n1', 'n1', 'no']
      ]
    }
  ]
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'spm-program-'))
  await copyFile(DEMO, join(dir, TAGS_FILE))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('project store · program.json (step 27)', () => {
  it('U-27.7 a project without program.json opens with program null (a new project)', async () => {
    const r = await openProject(dir)
    expect(r.ok && r.project.program).toBe(null)
  })

  it('U-27.8 save, then open again: the same program; saving it once more writes nothing', async () => {
    const w = await saveProgram(dir, PROGRAM)
    expect(w).toMatchObject({ ok: true, changed: true })
    const r = await openProject(dir)
    expect(r.ok && r.project.program).toEqual(PROGRAM)
    expect(await saveProgram(dir, PROGRAM)).toMatchObject({ ok: true, changed: false })
    expect((await readdir(dir)).sort()).toEqual([PROGRAM_FILE, TAGS_FILE]) // no .bak for a first save or no change
    expect(await readFile(prog(), 'utf8')).toContain('["n1", "end", "yes"]')
  })

  it('U-27.9 a changed save keeps the previous file as .bak and the file’s CRLF line endings', async () => {
    await saveProgram(dir, PROGRAM)
    const crlf = (await readFile(prog(), 'utf8')).replace(/\n/g, '\r\n')
    await writeFile(prog(), crlf)
    const moved: ProgramFile = structuredClone(PROGRAM)
    moved.flows[0]!.nodes[1]!.pos = [64, 96]
    expect(await saveProgram(dir, moved)).toMatchObject({ ok: true, changed: true })
    expect(await readFile(prog() + BACKUP_SUFFIX, 'utf8')).toBe(crlf)
    const now = await readFile(prog(), 'utf8')
    expect(now).toContain('"pos": [64, 96]')
    expect(now.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r'))).toBe(true)
  })

  it('U-27.10 a program that fails the schema is not written; a bad program.json on disk stops Open with the reason', async () => {
    const bad = { ...PROGRAM, flows: [{ ...PROGRAM.flows[0]!, name: 'S1 Main' }] } as ProgramFile
    const w = await saveProgram(dir, bad)
    expect(w.ok).toBe(false)
    expect(!w.ok && w.errors[0]).toMatch(/flows\.0\.name: does not match the nami/)
    await expect(readdir(dir)).resolves.toEqual([TAGS_FILE])
    await writeFile(prog(), JSON.stringify(bad))
    const r = await openProject(dir)
    expect(!r.ok && r.errors[0]).toMatch(/^program\.json › flows\.0\.name: does not match the nami/)
    await writeFile(prog(), '{ not json')
    const r2 = await openProject(dir)
    expect(!r2.ok && r2.errors[0]).toMatch(/^program\.json is not valid JSON/)
  })
})
