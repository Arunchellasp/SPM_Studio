/**
 * Step 11 rule: screens never type machine data in — it comes from fixtures/ (later the runtime).
 * This test reads every screen / shell source file and fails if it finds data-like literals:
 *   • a tag name in quotes            'Station.ClampFwd', "Plasma.Ready"
 *   • a decimal number                482.382, 4.85
 * Comments are ignored. Layout numbers (16, 120) are fine; they are not machine data.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/renderer/src/', import.meta.url))
const DIRS = ['features', 'shell']
const TAG_LITERAL = /['"`][A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*['"`]/
const DECIMAL = /(?<![\w.])\d+\.\d+(?![\w.])/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n: string) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}
const stripComments = (s: string): string =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('no machine data typed into screens', () => {
  const all = DIRS.flatMap((d) => files(join(SRC, d)))

  it('finds the screen files', () => {
    expect(all.length).toBeGreaterThan(5)
  })

  for (const f of all) {
    const rel = f.slice(SRC.length)
    it(rel, () => {
      const code = stripComments(readFileSync(f, 'utf8'))
      const lines = code.split('\n')
      const hits = lines.flatMap((l, i) => (TAG_LITERAL.test(l) || DECIMAL.test(l) ? [`${i + 1}: ${l.trim()}`] : []))
      expect(hits, `move these values to fixtures/:\n${hits.join('\n')}`).toEqual([])
    })
  }
})
