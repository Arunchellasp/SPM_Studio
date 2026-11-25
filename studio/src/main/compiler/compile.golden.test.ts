// Step 29 — golden files: 5 sample flows compiled and compared with the program.rt.json checked in next to them.
// A change in the compiler's output shows here as a text difference. After a WANTED change, look at the
// new files and write them with:  GOLDEN_UPDATE=1 npx vitest run src/main/compiler
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProgramFile, TagFile } from '@shared/ipc'
import { makeTagChecker } from '@shared/tags-schema'
import programSchema from '../../../../schemas/program.schema.json'
import rtSchema from '../../../../schemas/rt.schema.json'
import { compile, describe as line } from '@shared/compile'

const GOLDEN = resolve(__dirname, 'golden')
const tags = JSON.parse(readFileSync(resolve(__dirname, '../../../../projects/demo/tags.json'), 'utf8')) as TagFile
const checkProgram = makeTagChecker(programSchema)
const checkRt = makeTagChecker(rtSchema)
const samples = readdirSync(GOLDEN).sort()

describe('compiler golden files (step 29)', () => {
  it('U-29.1 there are 5 sample flows', () => {
    expect(samples).toEqual(['1-minimal', '2-line', '3-decision-loop', '4-move', '5-two-stations'])
  })

  for (const s of samples)
    it(`U-29.1 ${s}: program.json → program.rt.json exactly as the golden file, valid against rt.schema.json`, () => {
      const program = JSON.parse(readFileSync(join(GOLDEN, s, 'program.json'), 'utf8')) as ProgramFile
      expect(checkProgram(program)).toMatchObject({ ok: true })
      const r = compile(program, tags)
      if (!r.ok) throw new Error(r.errors.map(line).join('\n'))
      expect(checkRt(JSON.parse(r.text))).toMatchObject({ ok: true })
      const file = join(GOLDEN, s, 'program.rt.json')
      if (process.env.GOLDEN_UPDATE === '1' || !existsSync(file)) writeFileSync(file, r.text)
      expect(r.text).toBe(readFileSync(file, 'utf8'))
    })
})
