/**
 * Step 17 — TypeScript types made from the JSON schemas, never typed twice.
 *   npm run gen      → writes src/shared/generated/*.ts
 *   npm test         → tools/gen-types.test.ts fails when a generated file is out of date (so CI fails too)
 * Runs with plain Node (type stripping, Node ≥ 22.18): node tools/gen-types.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, type JSONSchema } from 'json-schema-to-typescript'

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface Target {
  /** schema file, relative to the repository root */
  schema: string
  /** generated file, relative to studio/ */
  out: string
  /** name of the root type (instead of one made from the schema title) */
  name: string
}

/** One line per schema. message.schema.json joins when the runtime link is built (protocol.ts is still hand-written). */
export const TARGETS: Target[] = [{ schema: 'schemas/tags.schema.json', out: 'src/shared/generated/tags.ts', name: 'TagFile' }]

const STYLE = { singleQuote: true, semi: false, printWidth: 140, trailingComma: 'none' } as const // = .prettierrc

/** the exact text of one generated file */
export async function generate(t: Target, edit?: (schema: JSONSchema) => void): Promise<string> {
  const schema = JSON.parse(readFileSync(resolve(STUDIO, '..', t.schema), 'utf8')) as JSONSchema
  edit?.(schema) // tests only: try a changed schema without touching the file
  schema.title = t.name // root type name: 'TagFile', not one made from the title or $id
  const banner = [
    `// GENERATED from ${t.schema} by tools/gen-types.mts — do not edit by hand.`,
    '// Change the schema, then run: npm run gen   (tools/gen-types.test.ts fails while this file is out of date)'
  ].join('\n')
  const ts = await compile(schema, t.name, { bannerComment: banner, style: STYLE, additionalProperties: false, cwd: resolve(STUDIO, '..', 'schemas') })
  return ts.replace(/\r\n/g, '\n')
}

export function outPath(t: Target): string {
  return resolve(STUDIO, t.out)
}

async function main(): Promise<void> {
  for (const t of TARGETS) {
    const text = await generate(t)
    mkdirSync(dirname(outPath(t)), { recursive: true })
    writeFileSync(outPath(t), text)
    console.log(`gen: ${t.schema} → ${t.out} (${text.split('\n').length} lines)`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
