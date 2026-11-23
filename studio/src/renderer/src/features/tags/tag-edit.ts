/**
 * N03 cell editing (step 19) — logic only, unit tested.
 * One edit = one tag, one column, one value → the new tag table, or a short reason why not.
 * Rules come from schemas/tags.schema.json (read here, never typed twice): name patterns per kind, scope pattern.
 * Rules ACROSS tags (address used twice, min < max …) are step 20; only unique names are checked here,
 * because the name is also the grid's row key.
 */
import tagsSchema from '../../../../../../schemas/tags.schema.json'
import type { Addr, Tag, TagKind } from '@shared/ipc'

type SchemaBlock = { if: { properties: { kind: { const: string } } }; then: { properties: { name: { pattern: string } } } }
const tagDef = tagsSchema.$defs.tag
const NAME_RE = new RegExp(tagDef.properties.name.pattern)
const SCOPE_RE = new RegExp(tagDef.properties.scope.pattern)
/** 'DI' → '^DI_' … read from the per-kind blocks of the schema */
const PREFIX: Record<string, string> = Object.fromEntries(
  (tagDef.allOf as unknown as SchemaBlock[]).map((b) => [b.if.properties.kind.const, b.then.properties.name.pattern])
)
const MAX_DESC = tagDef.properties.desc.maxLength
const MAX_TEXT = tagDef.properties.text.maxLength
const MAX_UNIT = tagDef.properties.unit.maxLength

export type EditField = 'name' | 'type' | 'scope' | 'unit' | 'init' | 'retain' | 'comment'

export type EditResult = { ok: true; tags: Tag[]; tag: Tag; note?: string } | { ok: false; error: string }

const VALUE_TYPES = ['BOOL', 'INT', 'DINT', 'REAL', 'STRING'] as const
export const EDITABLE_DTYPES: readonly string[] = VALUE_TYPES
const IO_KINDS: TagKind[] = ['DI', 'DO', 'AI', 'AO', 'AXIS']
const NO_UNIT: TagKind[] = ['DI', 'DO', 'TIMER', 'COUNTER', 'ALARM', 'UDT']
const UNIT_REQUIRED: TagKind[] = ['AI', 'AO', 'AXIS']
const RETAIN_KINDS: TagKind[] = ['REG', 'COUNTER', 'RECIPE', 'POINT']
const INIT_KEY: Partial<Record<TagKind, 'init' | 'default' | 'preset_ms' | 'preset'>> = {
  REG: 'init',
  RECIPE: 'default',
  TIMER: 'preset_ms',
  COUNTER: 'preset'
}

/** may this column be edited for this tag? (the grid asks before opening an editor) */
export function canEdit(tag: Pick<Tag, 'kind'>, field: EditField | 'address'): boolean {
  switch (field) {
    case 'name':
    case 'scope':
    case 'comment':
      return true
    case 'type':
      return tag.kind === 'REG' || tag.kind === 'RECIPE' // other kinds have a fixed dtype
    case 'unit':
      return !NO_UNIT.includes(tag.kind)
    case 'init':
      return INIT_KEY[tag.kind] !== undefined
    case 'retain':
      return RETAIN_KINDS.includes(tag.kind)
    case 'address':
      return IO_KINDS.includes(tag.kind)
  }
}

type Parsed = { ok: true; value: number | boolean | string } | { ok: false; error: string }

/** text from the grid → a value of the tag's dtype, or why not ('wrong type refused') */
export function parseValue(text: string, dtype: string | undefined): Parsed {
  const t = text.trim()
  switch (dtype) {
    case 'BOOL': {
      const u = t.toUpperCase()
      if (u === 'TRUE' || u === '1') return { ok: true, value: true }
      if (u === 'FALSE' || u === '0') return { ok: true, value: false }
      return { ok: false, error: `'${t}' is not a BOOL — use TRUE or FALSE` }
    }
    case 'INT':
    case 'DINT': {
      const [lo, hi] = dtype === 'INT' ? [-32768, 32767] : [-2147483648, 2147483647]
      if (!/^-?\d+$/.test(t)) return { ok: false, error: `'${t}' is not a whole number (${dtype})` }
      const n = Number(t)
      if (n < lo || n > hi) return { ok: false, error: `${t} is outside ${dtype} (${lo} … ${hi})` }
      return { ok: true, value: n }
    }
    case 'REAL': {
      const n = Number(t.replace(',', '.'))
      if (t === '' || !Number.isFinite(n)) return { ok: false, error: `'${t}' is not a number (REAL)` }
      return { ok: true, value: n }
    }
    default:
      return { ok: true, value: t } // STRING
  }
}

function replace(tags: Tag[], old: Tag, next: Tag): Tag[] {
  return tags.map((t) => (t === old ? next : t))
}

/** a copy without the keys whose value is undefined (an emptied cell removes its column) */
function clean(tag: Tag): Tag {
  return Object.fromEntries(Object.entries(tag).filter(([, v]) => v !== undefined)) as Tag
}

export function applyEdit(tags: Tag[], name: string, field: EditField, value: unknown): EditResult {
  const old = tags.find((t) => t.name === name)
  if (!old) return { ok: false, error: `no tag '${name}'` }
  if (!canEdit(old, field)) return { ok: false, error: `${field} cannot be changed for a ${old.kind} tag` }
  const text = typeof value === 'string' ? value.trim() : ''
  const done = (next: Tag, note?: string): EditResult => {
    const tag = clean(next)
    return { ok: true, tags: replace(tags, old, tag), tag, note }
  }

  switch (field) {
    case 'name': {
      if (text === old.name) return done(old)
      if (!NAME_RE.test(text)) return { ok: false, error: `'${text}' — use A–Z a–z 0–9 _ like DI_S1_PartPresent` }
      const prefix = PREFIX[old.kind]
      if (prefix && !new RegExp(prefix).test(text)) return { ok: false, error: `a ${old.kind} name must start with ${prefix.replace('^', '')}` }
      if (tags.some((t) => t.name === text)) return { ok: false, error: `'${text}' is already used by another tag` }
      return done({ ...old, name: text })
    }
    case 'type': {
      if (!VALUE_TYPES.includes(text as (typeof VALUE_TYPES)[number])) return { ok: false, error: `type must be one of ${VALUE_TYPES.join(', ')}` }
      const key = INIT_KEY[old.kind]!
      const current = old[key]
      let note: string | undefined
      let keep: unknown = current
      if (current !== undefined) {
        const again = parseValue(String(current), text)
        keep = again.ok ? again.value : undefined
        if (!again.ok) note = `${key === 'default' ? 'Default' : 'Init'} ${String(current)} did not fit ${text} and was cleared`
      }
      if (keep === undefined && key === 'default') return { ok: false, error: `the default ${String(current)} is not a ${text} — change the default first` }
      return done({ ...old, dtype: text as Tag['dtype'], [key]: keep }, note)
    }
    case 'scope': {
      const s = text || 'global'
      if (!SCOPE_RE.test(s)) return { ok: false, error: `scope '${s}' — use global, S1 … S99, flow:<name> or fn:<name>` }
      return done({ ...old, scope: s })
    }
    case 'unit': {
      if (!text && UNIT_REQUIRED.includes(old.kind)) return { ok: false, error: `a ${old.kind} tag needs a unit` }
      if (text.length > MAX_UNIT) return { ok: false, error: `unit is at most ${MAX_UNIT} characters` }
      return done({ ...old, unit: text || undefined })
    }
    case 'init': {
      const key = INIT_KEY[old.kind]!
      if (!text) {
        if (key === 'init') return done({ ...old, init: undefined })
        return { ok: false, error: `${key} is required for a ${old.kind} tag` }
      }
      if (key === 'preset_ms' || key === 'preset') {
        if (!/^\d+$/.test(text)) return { ok: false, error: `'${text}' — ${key} is a whole number ≥ 0` }
        return done({ ...old, [key]: Number(text) })
      }
      const p = parseValue(text, old.dtype)
      return p.ok ? done({ ...old, [key]: p.value }) : p
    }
    case 'retain':
      return done({ ...old, retain: value === true ? true : undefined })
    case 'comment': {
      if (old.kind === 'ALARM') {
        if (!text) return { ok: false, error: 'an alarm needs its text' }
        if (text.length > MAX_TEXT) return { ok: false, error: `alarm text is at most ${MAX_TEXT} characters` }
        return done({ ...old, text })
      }
      if (text.length > MAX_DESC) return { ok: false, error: `comment is at most ${MAX_DESC} characters` }
      return done({ ...old, desc: text || undefined })
    }
  }
}

/** the address picker's result → the tag table. I/O needs a channel; an axis (drive) has none. */
export function applyAddress(tags: Tag[], name: string, addr: Addr): EditResult {
  const old = tags.find((t) => t.name === name)
  if (!old) return { ok: false, error: `no tag '${name}'` }
  if (!canEdit(old, 'address')) return { ok: false, error: `a ${old.kind} tag lives in memory and has no address` }
  if (!['ecat', 'sim'].includes(addr.bus)) return { ok: false, error: 'bus must be ecat or sim' }
  if (!Number.isInteger(addr.slave) || addr.slave < 0 || addr.slave > 511) return { ok: false, error: 'slave is a whole number 0 … 511' }
  const isAxis = old.kind === 'AXIS'
  if (!isAxis && (addr.ch === undefined || !Number.isInteger(addr.ch) || addr.ch < 0 || addr.ch > 255))
    return { ok: false, error: 'channel is a whole number 0 … 255' }
  const next: Addr = isAxis ? { bus: addr.bus, slave: addr.slave } : { bus: addr.bus, slave: addr.slave, ch: addr.ch }
  const tag = { ...old, addr: next }
  return { ok: true, tags: replace(tags, old, tag), tag }
}
