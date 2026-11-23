/**
 * Tag table ⇄ rows for CSV / Excel (step 22) — pure, used by the main process (exchange.ts) and tests.
 *
 * One row per tag. The first columns are what an engineer edits in a sheet; every other field of the tag
 * goes into the last column 'more' as JSON. So the round trip tags → sheet → tags loses nothing,
 * also for fields that only some kinds have (scale, alarm, axes …) or that a later schema adds.
 *
 * Values keep their type: numbers stay numbers, BOOL values are TRUE / FALSE. A CSV cell is always text,
 * so fromRows turns text back into numbers / booleans where the column (or the tag's dtype) says so.
 */
import type { Tag } from './ipc'

export const TABLE_COLUMNS = ['name', 'kind', 'dtype', 'scope', 'bus', 'slave', 'ch', 'unit', 'init', 'min', 'max', 'retain', 'desc', 'group', 'more'] as const
export type TableColumn = (typeof TABLE_COLUMNS)[number]
export type Cell = string | number | boolean | null
export type TableRow = Record<TableColumn, Cell>

/** fields that have their own column (everything else → 'more') */
const OWN = new Set(['name', 'kind', 'dtype', 'scope', 'addr', 'unit', 'init', 'min', 'max', 'retain', 'desc', 'group'])
const NUMBER_COLS: TableColumn[] = ['slave', 'ch', 'min', 'max']

export function toRows(tags: Tag[]): TableRow[] {
  return tags.map((t) => {
    const more = Object.fromEntries(Object.entries(t).filter(([k]) => !OWN.has(k)))
    return {
      name: t.name,
      kind: t.kind,
      dtype: t.dtype ?? null,
      scope: t.scope ?? null,
      bus: t.addr?.bus ?? null,
      slave: t.addr?.slave ?? null,
      ch: t.addr?.ch ?? null,
      unit: t.unit ?? null,
      init: t.init ?? null,
      min: t.min ?? null,
      max: t.max ?? null,
      retain: t.retain ?? null,
      desc: t.desc ?? null,
      group: t.group ?? null,
      more: Object.keys(more).length ? JSON.stringify(more) : null
    }
  })
}

export interface FromRowsResult {
  tags: Tag[]
  /** 'row 5: …' — rows that could not be read are left out, the rest is imported */
  errors: string[]
}

const empty = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

function toNumber(v: Cell): number | undefined {
  if (empty(v)) return undefined
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function toBool(v: Cell): boolean | undefined {
  if (empty(v)) return undefined
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toUpperCase()
  if (s === 'TRUE' || s === '1') return true
  if (s === 'FALSE' || s === '0') return false
  return undefined
}

/** an Init cell: typed by the tag's dtype (CSV gives text, Excel gives numbers / booleans) */
function toInit(v: Cell, dtype: unknown): Cell | undefined {
  if (empty(v)) return undefined
  if (dtype === 'BOOL') return toBool(v) ?? String(v)
  if (dtype === 'STRING') return String(v)
  if (typeof v === 'number' || typeof v === 'boolean') return v
  const n = toNumber(v)
  return n !== undefined && !Number.isNaN(n) ? n : String(v)
}

/** rows from a sheet (header names = TABLE_COLUMNS, any order, extra columns ignored) → tags */
export function fromRows(rows: Partial<Record<string, Cell>>[]): FromRowsResult {
  const tags: Tag[] = []
  const errors: string[] = []
  rows.forEach((r, i) => {
    const line = i + 2 // row 1 is the header
    if (TABLE_COLUMNS.every((c) => empty(r[c] ?? null))) return // blank line
    const name = empty(r.name ?? null) ? '' : String(r.name).trim()
    const kind = empty(r.kind ?? null) ? '' : String(r.kind).trim()
    if (!name || !kind) return void errors.push(`row ${line}: name and kind are needed`)
    const t: Record<string, unknown> = { name, kind }
    let more: Record<string, unknown> = {}
    if (!empty(r.more ?? null)) {
      try {
        more = JSON.parse(String(r.more)) as Record<string, unknown>
      } catch {
        return void errors.push(`row ${line} (${name}): column 'more' is not valid JSON`)
      }
    }
    if (!empty(r.dtype ?? null)) t.dtype = String(r.dtype).trim()
    if (!empty(r.scope ?? null)) t.scope = String(r.scope).trim()
    if (!empty(r.bus ?? null)) {
      const slave = toNumber(r.slave ?? null)
      const ch = toNumber(r.ch ?? null)
      if (slave === undefined || Number.isNaN(slave)) return void errors.push(`row ${line} (${name}): slave must be a number`)
      if (Number.isNaN(ch)) return void errors.push(`row ${line} (${name}): ch must be a number`)
      t.addr = ch === undefined ? { bus: String(r.bus).trim(), slave } : { bus: String(r.bus).trim(), slave, ch }
    }
    if (!empty(r.unit ?? null)) t.unit = String(r.unit)
    const init = toInit(r.init ?? null, t.dtype)
    if (init !== undefined) t.init = init
    for (const c of NUMBER_COLS.filter((c) => c === 'min' || c === 'max')) {
      const n = toNumber(r[c] ?? null)
      if (Number.isNaN(n)) return void errors.push(`row ${line} (${name}): ${c} must be a number`)
      if (n !== undefined) t[c] = n
    }
    const retain = toBool(r.retain ?? null)
    if (retain !== undefined) t.retain = retain
    if (!empty(r.desc ?? null)) t.desc = String(r.desc)
    if (!empty(r.group ?? null)) t.group = String(r.group)
    tags.push({ ...t, ...more } as Tag)
  })
  return { tags, errors }
}

/** import plan for the preview dialog: by name — new, changed, the same, and (for 'replace') removed */
export interface ImportPlan {
  added: string[]
  changed: string[]
  same: string[]
  /** in the project but not in the file (only removed when the user picks 'replace') */
  missing: string[]
}

const canon = (t: Tag): string => JSON.stringify(Object.fromEntries(Object.entries(t).sort(([a], [b]) => (a < b ? -1 : 1))))

export function planImport(current: Tag[], incoming: Tag[]): ImportPlan {
  const now = new Map(current.map((t) => [t.name, t]))
  const inc = new Set(incoming.map((t) => t.name))
  const plan: ImportPlan = { added: [], changed: [], same: [], missing: [] }
  for (const t of incoming) {
    const old = now.get(t.name)
    if (!old) plan.added.push(t.name)
    else if (canon(old) === canon(t)) plan.same.push(t.name)
    else plan.changed.push(t.name)
  }
  plan.missing = current.filter((t) => !inc.has(t.name)).map((t) => t.name)
  return plan
}

/** merge: file rows replace tags of the same name, new ones are added, the rest stays · replace: the file is the table */
export function applyImport(current: Tag[], incoming: Tag[], mode: 'merge' | 'replace'): Tag[] {
  if (mode === 'replace') return incoming
  const inc = new Map(incoming.map((t) => [t.name, t]))
  const kept = current.map((t) => inc.get(t.name) ?? t)
  const names = new Set(current.map((t) => t.name))
  return [...kept, ...incoming.filter((t) => !names.has(t.name))]
}
