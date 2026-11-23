// Step 16 — the screens run under a strict Content-Security-Policy (index.html: script-src 'self', no 'unsafe-eval').
// Ajv compiles its checker with new Function() → blocked there. The schema check runs in the main process;
// this test fails if a screen file imports Ajv or the checker again.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../src/renderer/src')
const FORBIDDEN = /from ['"](ajv[^'"]*|@shared\/tags-schema)['"]/

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
  )
}

describe('screens stay inside the CSP', () => {
  it('U-16.16 index.html forbids eval (no unsafe-eval in script-src)', () => {
    const html = readFileSync(resolve(ROOT, '../index.html'), 'utf8')
    expect(html).toMatch(/script-src 'self';/)
    expect(html).not.toContain('unsafe-eval')
  })

  it('U-16.17 no screen file imports Ajv or the schema checker (they need eval)', () => {
    const bad = files(ROOT).filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f))
    expect(bad, 'run the schema check in the main process (project/store.ts)').toEqual([])
  })
})
