/**
 * Tag table rules (step 20) — pure, no Ajv, so they run everywhere: in the screens (red cells, CSP-safe),
 * in the main process before a save, and in tests.
 *
 *  1. per kind, READ FROM schemas/tags.schema.json (never typed twice): name prefix, required columns,
 *     fixed dtype, memory kinds have no address, I/O kinds need one
 *  2. across tags (a schema looks at one value at a time and cannot do these):
 *     duplicate name · address used twice · min ≥ max · Init outside min … max · soft limits ·
 *     alarm limits must rise · empty scaling range · broken references (POINT axes, UDT fields)
 *
 * Each problem names the tag, the grid column to paint red, and a short reason.
 */
import tagsSchema from '../../../schemas/tags.schema.json'
import type { Tag, TagKind } from './ipc'

/** the editable grid columns a problem is shown on */
export type IssueColumn = 'name' | 'address' | 'type' | 'scope' | 'unit' | 'init' | 'retain' | 'comment'

export type RuleId =
  | 'kind-prefix'
  | 'kind-required'
  | 'kind-dtype'
  | 'kind-address'
  | 'duplicate-name'
  | 'address-twice'
  | 'min-max'
  | 'init-range'
  | 'soft-limits'
  | 'alarm-limits'
  | 'scale'
  | 'reference'

export interface TagIssue {
  tag: string
  column: IssueColumn
  rule: RuleId
  message: string
}

// ---------------------------------------------------------------- per-kind rules from the schema
interface KindRule {
  prefix: RegExp
  prefixText: string
  required: string[]
  dtype?: string[] // allowed dtypes when the schema restricts them
  memory: boolean // 'not: required addr'
}
type Block = {
  if: { properties: { kind: { const: string } } }
  then: {
    required?: string[]
    not?: { required: string[] }
    properties: { name: { pattern: string }; dtype?: { const?: string; enum?: string[] } }
  }
}
export const KIND_RULES: Record<string, KindRule> = Object.fromEntries(
  (tagsSchema.$defs.tag.allOf as unknown as Block[]).map((b) => {
    const p = b.then.properties
    const dt = p.dtype ? (p.dtype.const ? [p.dtype.const] : p.dtype.enum) : undefined
    return [
      b.if.properties.kind.const,
      {
        prefix: new RegExp(p.name.pattern),
        prefixText: p.name.pattern.replace('^', '').replace('[A-Z]{2,3}_', '2–3 capitals + _'),
        required: b.then.required ?? [],
        dtype: dt,
        memory: !!b.then.not?.required.includes('addr')
      }
    ]
  })
)

/** columns that belong to one kind only (required by some kind) — dropped when the kind changes */
export const KIND_SPECIFIC = [...new Set(Object.values(KIND_RULES).flatMap((r) => r.required))]

const COLUMN_OF: Record<string, IssueColumn> = {
  addr: 'address',
  unit: 'unit',
  dtype: 'type',
  preset_ms: 'init',
  preset: 'init',
  default: 'init',
  scale: 'unit',
  text: 'comment'
}

function perKind(t: Tag, out: TagIssue[]): void {
  const r = KIND_RULES[t.kind]
  if (!r) return
  const add = (column: IssueColumn, rule: RuleId, message: string): void => void out.push({ tag: t.name, column, rule, message })
  if (!r.prefix.test(t.name)) add('name', 'kind-prefix', `a ${t.kind} name must start with ${r.prefixText}`)
  for (const col of r.required) {
    if ((t as Record<string, unknown>)[col] === undefined) add(COLUMN_OF[col] ?? 'name', 'kind-required', `a ${t.kind} tag needs ${col === 'addr' ? 'an address' : col}`)
  }
  if (r.dtype && t.dtype !== undefined && !r.dtype.includes(t.dtype)) add('type', 'kind-dtype', `type of a ${t.kind} must be ${r.dtype.join(' or ')}`)
  if (r.memory && t.addr) add('address', 'kind-address', `a ${t.kind} tag lives in memory and must not have an address`)
  if (t.addr && !r.memory && t.kind !== 'AXIS' && t.kind !== 'UDT' && t.addr.ch === undefined) add('address', 'kind-required', `a ${t.kind} address needs a channel`)
}

// ---------------------------------------------------------------- across tags
const IO: TagKind[] = ['DI', 'DO', 'AI', 'AO']

function addrText(t: Tag): string {
  const a = t.addr!
  return a.ch === undefined ? `${a.bus} ${a.slave}` : `${a.bus} ${a.slave}:${a.ch}`
}

function across(tags: Tag[], out: TagIssue[]): void {
  // duplicate names
  const byName = new Map<string, Tag[]>()
  for (const t of tags) byName.set(t.name, [...(byName.get(t.name) ?? []), t])
  for (const [name, list] of byName)
    if (list.length > 1) out.push({ tag: name, column: 'name', rule: 'duplicate-name', message: `the name ${name} is used ${list.length} times` })

  // address used twice: I/O channel, or a drive's slave (an axis owns its whole slave)
  const io = tags.filter((t) => t.addr && IO.includes(t.kind))
  const axes = tags.filter((t) => t.addr && t.kind === 'AXIS')
  const key = (t: Tag): string => `${t.addr!.bus}:${t.addr!.slave}:${t.addr!.ch ?? '-'}`
  const seen = new Map<string, Tag[]>()
  for (const t of io) seen.set(key(t), [...(seen.get(key(t)) ?? []), t])
  for (const list of seen.values())
    for (const t of list)
      for (const o of list)
        if (o !== t) out.push({ tag: t.name, column: 'address', rule: 'address-twice', message: `address ${addrText(t)} is also used by ${o.name}` })
  for (const ax of axes) {
    const clash = [...axes, ...io].filter((o) => o !== ax && o.addr!.bus === ax.addr!.bus && o.addr!.slave === ax.addr!.slave)
    for (const o of clash) {
      out.push({ tag: ax.name, column: 'address', rule: 'address-twice', message: `slave ${ax.addr!.bus} ${ax.addr!.slave} is also used by ${o.name}` })
      if (o.kind !== 'AXIS') out.push({ tag: o.name, column: 'address', rule: 'address-twice', message: `slave ${o.addr!.bus} ${o.addr!.slave} is the drive of ${ax.name}` })
    }
  }

  const names = new Set(tags.map((t) => t.name))
  const kindOf = new Map(tags.map((t) => [t.name, t.kind]))
  for (const t of tags) {
    const add = (column: IssueColumn, rule: RuleId, message: string): void => void out.push({ tag: t.name, column, rule, message })
    // min / max and the start value
    const badRange = t.min !== undefined && t.max !== undefined && t.min >= t.max
    if (badRange) add('init', 'min-max', `min ${t.min} must be below max ${t.max}`)
    const start = t.kind === 'RECIPE' ? t.default : t.init
    if (typeof start === 'number' && !badRange) {
      // (a broken range is reported once, not again for the start value)
      if (t.min !== undefined && start < t.min) add('init', 'init-range', `${t.kind === 'RECIPE' ? 'default' : 'init'} ${start} is below min ${t.min}`)
      if (t.max !== undefined && start > t.max) add('init', 'init-range', `${t.kind === 'RECIPE' ? 'default' : 'init'} ${start} is above max ${t.max}`)
    }
    if (t.soft_min !== undefined && t.soft_max !== undefined && t.soft_min >= t.soft_max)
      add('unit', 'soft-limits', `soft limit min ${t.soft_min} must be below max ${t.soft_max}`)
    // alarm limits rise: lolo < lo < hi < hihi (those that are set)
    if (t.alarm) {
      const order = (['lolo', 'lo', 'hi', 'hihi'] as const).filter((k) => t.alarm![k] !== undefined)
      for (let i = 1; i < order.length; i++)
        if (t.alarm[order[i - 1]!]! >= t.alarm[order[i]!]!) {
          add('name', 'alarm-limits', `alarm limits must rise: ${order[i - 1]} ${t.alarm[order[i - 1]!]} ≥ ${order[i]} ${t.alarm[order[i]!]}`)
          break
        }
    }
    // scaling
    if (t.scale) {
      const [r0, r1] = t.scale.raw
      const [e0, e1] = t.scale.eng
      if (r0 >= r1) add('unit', 'scale', `raw range ${r0} … ${r1} must rise`)
      if (e0 === e1) add('unit', 'scale', `eng range ${e0} … ${e1} is empty`)
    }
    // references
    if (t.kind === 'POINT') {
      for (const a of t.axes ?? []) {
        if (!names.has(a)) add('name', 'reference', `axis ${a} does not exist`)
        else if (kindOf.get(a) !== 'AXIS') add('name', 'reference', `${a} is not an axis`)
      }
      if (t.axes && t.values && t.axes.length !== t.values.length) add('name', 'reference', `${t.axes.length} axes but ${t.values.length} values`)
    }
    if (t.kind === 'UDT')
      for (const [member, ref] of Object.entries(t.fields ?? {})) if (!names.has(ref)) add('name', 'reference', `field ${member} → ${ref} does not exist`)
  }
}

/** every problem of the table, in tag order; [] = ready to save */
export function checkTags(tags: Tag[]): TagIssue[] {
  const out: TagIssue[] = []
  for (const t of tags) perKind(t, out)
  across(tags, out)
  const order = new Map(tags.map((t, i) => [t.name, i]))
  return out.sort((a, b) => (order.get(a.tag) ?? 0) - (order.get(b.tag) ?? 0))
}

/** 'tag … : message' for toasts and the main process */
export function issueText(i: TagIssue): string {
  return `${i.tag}: ${i.message}`
}
