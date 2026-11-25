/**
 * Compile a project folder (step 29): <dir>/program.json + <dir>/tags.json → <dir>/program.rt.json
 *
 *   npm run compile -- ../projects/demo
 *
 * Prints every error (flow · node: message) and writes nothing when there is one. The compiler itself is
 * src/main/compiler/compile.ts — the same code the Build button will call (step 30).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

const here = fileURLToPath(new URL('.', import.meta.url))
const jiti = createJiti(import.meta.url, { alias: { '@shared': resolve(here, '../src/shared') } })
const { compile, describe } = (await jiti.import(resolve(here, '../src/main/compiler/compile.ts'))) as typeof import('../src/main/compiler/compile')

const dir = resolve(process.argv[2] ?? '.')
for (const f of ['program.json', 'tags.json'])
  if (!existsSync(join(dir, f))) {
    console.error(`compile: no ${f} in ${dir}`)
    process.exit(2)
  }
const r = compile(JSON.parse(readFileSync(join(dir, 'program.json'), 'utf8')), JSON.parse(readFileSync(join(dir, 'tags.json'), 'utf8')))
if (!r.ok) {
  console.error(`compile: ${r.errors.length} ${r.errors.length === 1 ? 'error' : 'errors'} — program.rt.json not written`)
  for (const e of r.errors) console.error('  ' + describe(e))
  process.exit(1)
}
writeFileSync(join(dir, 'program.rt.json'), r.text)
const steps = r.rt.flows.reduce((n, f) => n + f.steps.length, 0)
console.log(`compile: ${join(dir, 'program.rt.json')} · ${r.rt.flows.length} flows · ${steps} steps · crc ${r.rt.crc} · tags_crc ${r.rt.tags_crc}`)
