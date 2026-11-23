// Step 18 — the 1000-tag speed-test project is a valid tags.json (schema) with unique names and addresses.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeBigProject } from '../src/shared/big-project'
import { makeTagChecker } from '../src/shared/tags-schema'

const schema = JSON.parse(readFileSync(resolve(__dirname, '../../schemas/tags.schema.json'), 'utf8'))

describe('big project', () => {
  it('U-18.7 1000 tags, valid against tags.schema.json, unique names and addresses', () => {
    const file = makeBigProject()
    expect(file.tags).toHaveLength(1000)
    expect(makeTagChecker(schema)(file)).toEqual({ ok: true, errors: [] })
    expect(new Set(file.tags.map((t) => t.name)).size).toBe(1000)
    const addrs = file.tags.filter((t) => t.addr).map((t) => JSON.stringify(t.addr))
    expect(new Set(addrs).size).toBe(addrs.length)
  })
})
