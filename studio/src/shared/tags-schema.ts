// Checks a tags.json file against schemas/tags.schema.json and turns Ajv's
// errors into short sentences a person can act on:
//   "tag 3 'DI_S1_ClampOpen' › addr: must have property 'ch'"
// strictRequired is off: the per-kind blocks require fields declared in the main tag list.
// Cross-row rules (unique names, address used twice, min < max) come later in tags.rules.ts.
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'

export interface TagCheck {
  ok: boolean
  errors: string[]
}

export function makeTagChecker(schema: object): (data: unknown) => TagCheck {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true })
  const validate = ajv.compile(schema)
  return (data) => {
    if (validate(data)) return { ok: true, errors: [] }
    const errors = (validate.errors ?? [])
      .filter((e) => e.keyword !== 'if' && e.keyword !== 'allOf')
      .map((e) => explain(e, data))
    return { ok: false, errors: [...new Set(errors)] }
  }
}

function explain(e: ErrorObject, data: unknown): string {
  const parts = e.instancePath.split('/').filter(Boolean)
  let where = 'file'
  if (parts[0] === 'tags' && parts[1] !== undefined) {
    const i = Number(parts[1])
    const tags = (data as { tags?: { name?: unknown }[] }).tags
    const name = tags?.[i]?.name
    where = `tag ${i}${typeof name === 'string' ? ` '${name}'` : ''}`
    if (parts.length > 2) where += ` › ${parts.slice(2).join('.')}`
  } else if (parts.length) {
    where = parts.join('.')
  }
  return `${where}: ${message(e)}`
}

function message(e: ErrorObject): string {
  const p = e.params as Record<string, unknown>
  switch (e.keyword) {
    case 'required':
      return `must have property '${String(p.missingProperty)}'`
    case 'additionalProperties':
      return `unknown property '${String(p.additionalProperty)}'`
    case 'enum':
      return `must be one of ${(p.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ')}`
    case 'const':
      return `must be ${JSON.stringify(p.allowedValue)}`
    case 'pattern':
      return `does not match the naming rule ${String(p.pattern)}`
    case 'not':
      return 'must not have this property set (memory tags have no address)'
    default:
      return e.message ?? e.keyword
  }
}
