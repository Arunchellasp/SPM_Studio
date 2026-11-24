/**
 * N02 property panel (step 25) — what each node type's fields are, logic only (unit tested).
 * The panel draws its form from FIELDS; tag fields only offer tags of the right kind
 * (Software implementation › 4b: 'tag fields use autocomplete filtered by kind (WAIT_DI only offers DI / REG BOOL)').
 */
import type { Tag } from '@shared/ipc'
import type { StepKind, StepParams } from './flow'
import { parseCondition } from './flow-expr'

export type FieldKind = 'tag' | 'number' | 'bool' | 'expr'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  /** tag fields: may this tag be chosen here? */
  accepts?: (t: Tag) => boolean
  /** tag fields: what the list offers, in words (shown under the field) */
  offers?: string
  /** a tag field that may stay empty (e.g. the alarm of a wait) */
  optional?: boolean
  unit?: string
  min?: number
  max?: number
  hint?: string
}

const isDI = (t: Tag): boolean => t.kind === 'DI'
const isBoolReg = (t: Tag): boolean => t.kind === 'REG' && t.dtype === 'BOOL'

export const FIELDS: { [K in StepKind]: FieldDef[] } = {
  move_abs: [
    { key: 'axis', label: 'Axis', kind: 'tag', accepts: (t) => t.kind === 'AXIS', offers: 'axes (AXIS)' },
    { key: 'point', label: 'Point', kind: 'tag', accepts: (t) => t.kind === 'POINT', offers: 'points of this axis (POINT)' },
    { key: 'speed', label: 'Speed', kind: 'number', unit: '%', min: 1, max: 100, hint: '% of the axis vmax' }
  ],
  wait_di: [
    { key: 'tag', label: 'Input', kind: 'tag', accepts: (t) => isDI(t) || isBoolReg(t), offers: 'digital inputs (DI) and BOOL registers' },
    { key: 'value', label: 'Wait for', kind: 'bool' },
    { key: 'timeout_ms', label: 'Timeout', kind: 'number', unit: 'ms', min: 0, max: 600000, hint: '0 = wait for ever' },
    { key: 'alarm', label: 'Alarm on timeout', kind: 'tag', accepts: (t) => t.kind === 'ALARM', offers: 'alarms (ALARM)', optional: true }
  ],
  set_do: [
    { key: 'tag', label: 'Output', kind: 'tag', accepts: (t) => t.kind === 'DO', offers: 'digital outputs (DO)' },
    { key: 'value', label: 'Set to', kind: 'bool' }
  ],
  delay: [{ key: 'ms', label: 'Time', kind: 'number', unit: 'ms', min: 1, max: 3600000, hint: '1 ms … 1 h' }],
  if: [{ key: 'expr', label: 'Condition', kind: 'expr', hint: 'tags and numbers with = <> < <= > >=, + − * /, AND OR NOT, ( )' }]
}

/** the tags a field offers, sorted by name; Move › Point: only points that use the chosen axis */
export function tagsFor(type: StepKind, f: FieldDef, tags: Tag[], p: StepParams[StepKind]): Tag[] {
  let list = tags.filter((t) => f.accepts?.(t))
  if (type === 'move_abs' && f.key === 'point') {
    const axis = (p as StepParams['move_abs']).axis
    if (axis) list = list.filter((t) => t.axes?.includes(axis))
  }
  return list.sort((a, b) => (a.name < b.name ? -1 : 1))
}

export type ParseResult = { ok: true; value: string | number | boolean } | { ok: false; error: string }

/** a value typed / chosen in the panel → the parameter, or why not */
export function parseField(type: StepKind, f: FieldDef, raw: string | boolean, tags: Tag[], p: StepParams[StepKind]): ParseResult {
  if (f.kind === 'bool') return { ok: true, value: raw === true || raw === 'TRUE' }
  const text = String(raw).trim()
  if (f.kind === 'expr') {
    if (!text) return { ok: true, value: '' } // open: dashed until filled
    const r = parseCondition(text)
    if (!r.ok) return { ok: false, error: r.error }
    const unknown = tags.length ? r.names.filter((n) => !tags.some((t) => t.name === n)) : []
    if (unknown.length) return { ok: false, error: `no tag ${unknown.join(', ')} in the project` }
    return { ok: true, value: text }
  }
  if (f.kind === 'number') {
    if (!/^\d+$/.test(text)) return { ok: false, error: `a whole number${f.unit ? ` in ${f.unit}` : ''}` }
    const n = Number(text)
    if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max))
      return { ok: false, error: `${f.min} … ${f.max}${f.unit ? ` ${f.unit}` : ''}` }
    return { ok: true, value: n }
  }
  // tag
  if (!text) return f.optional ? { ok: true, value: '' } : { ok: false, error: `choose one of the ${f.offers}` }
  if (!tags.some((t) => t.name === text)) return { ok: false, error: `no tag ${text} in the project` }
  if (!tagsFor(type, f, tags, p).some((t) => t.name === text)) return { ok: false, error: `${text} is not one of the ${f.offers}` }
  return { ok: true, value: text }
}

/** a changed axis can make the chosen point wrong → the point is cleared (shown again as 'point?') */
export function afterChange(type: StepKind, key: string, p: StepParams[StepKind], tags: Tag[]): StepParams[StepKind] {
  if (type === 'move_abs' && key === 'axis') {
    const q = p as StepParams['move_abs']
    const point = tags.find((t) => t.name === q.point)
    if (q.point && !(q.axis && point?.axes?.includes(q.axis))) return { ...q, point: '' }
  }
  return p
}
