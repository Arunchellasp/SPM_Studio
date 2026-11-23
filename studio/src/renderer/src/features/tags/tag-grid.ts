/**
 * N03 tag grid — logic only (unit tested): how a tag becomes a grid row, the kind groups of the
 * segmented filter, and the filter itself. The view (tag-grid.view.tsx) hands these to Tabulator.
 */
import type { Tag, TagKind } from '@shared/ipc'
import type { IssueColumn, TagIssue } from '@shared/tags-rules'

/** the segmented filter of the design: All · Inputs · Outputs · Flags · Data · Timers · Points */
export type KindGroup = 'all' | 'inputs' | 'outputs' | 'flags' | 'data' | 'timers' | 'points'

export const KIND_GROUPS: { value: KindGroup; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inputs', label: 'Inputs' },
  { value: 'outputs', label: 'Outputs' },
  { value: 'flags', label: 'Flags' },
  { value: 'data', label: 'Data' },
  { value: 'timers', label: 'Timers' },
  { value: 'points', label: 'Points' }
]

/** every tag is in exactly one group (U-18.2): a BOOL register is a flag, other registers are data */
export function groupOf(tag: Pick<Tag, 'kind' | 'dtype'>): Exclude<KindGroup, 'all'> {
  const byKind: Record<TagKind, Exclude<KindGroup, 'all'>> = {
    DI: 'inputs',
    AI: 'inputs',
    DO: 'outputs',
    AO: 'outputs',
    REG: 'data',
    ALARM: 'flags',
    RECIPE: 'data',
    UDT: 'data',
    TIMER: 'timers',
    COUNTER: 'timers',
    POINT: 'points',
    AXIS: 'points'
  }
  if (tag.kind === 'REG' && tag.dtype === 'BOOL') return 'flags'
  return byKind[tag.kind]
}

/** kinds whose dtype is STRUCT: the kind says more than 'STRUCT' in the Type column */
const SHOW_KIND_AS_TYPE: TagKind[] = ['AXIS', 'TIMER', 'COUNTER', 'ALARM', 'UDT', 'POINT']

/** one grid row = the 10 columns of the design + what the filter and the details panel need */
export interface GridRow {
  name: string
  address: string
  type: string
  scope: string
  unit: string
  init: string
  retain: string
  mappedTo: string
  live: string
  comment: string
  kind: TagKind
  dtype?: string
  group: Exclude<KindGroup, 'all'>
  /** step 20: problems of this tag per grid column (red cell + tooltip) */
  issues?: Partial<Record<IssueColumn, string[]>>
}

const NONE = '–'

/** 'ecat 3:0' (bus, slave, channel) — memory tags have no address */
export function addressText(tag: Tag): string {
  const a = tag.addr
  if (!a) return NONE
  return a.ch === undefined ? `${a.bus} ${a.slave}` : `${a.bus} ${a.slave}:${a.ch}`
}

function valueText(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/** problems of one tag, grouped by the column that shows them */
export function issuesByColumn(list: TagIssue[] | undefined): GridRow['issues'] {
  if (!list?.length) return undefined
  const out: Partial<Record<IssueColumn, string[]>> = {}
  for (const i of list) (out[i.column] ??= []).push(i.message)
  return out
}

export function toGridRow(tag: Tag, issues?: TagIssue[]): GridRow {
  return {
    name: tag.name,
    address: addressText(tag),
    type: SHOW_KIND_AS_TYPE.includes(tag.kind) ? tag.kind : (tag.dtype ?? tag.kind),
    scope: tag.scope ?? 'global',
    unit: tag.unit ?? (tag.kind === 'TIMER' ? 'ms' : ''),
    init: valueText(tag.init ?? tag.default ?? (tag.kind === 'TIMER' ? tag.preset_ms : tag.kind === 'COUNTER' ? tag.preset : undefined)),
    retain: tag.retain ? '✓' : '',
    mappedTo: '', // card / channel from the N04 card tree (later step)
    live: NONE, // live value from the runtime (phase G)
    comment: tag.desc ?? tag.text ?? '',
    kind: tag.kind,
    dtype: tag.dtype,
    group: groupOf(tag),
    issues: issuesByColumn(issues)
  }
}

export interface GridFilter {
  text: string
  scope: string // 'all' or a scope
  type: string // 'all' or a Type column value
  group: KindGroup
}

export const NO_FILTER: GridFilter = { text: '', scope: 'all', type: 'all', group: 'all' }

/** search looks in name, comment and address, ignoring case; the other filters must match exactly */
export function matches(row: GridRow, f: GridFilter): boolean {
  if (f.group !== 'all' && row.group !== f.group) return false
  if (f.scope !== 'all' && row.scope !== f.scope) return false
  if (f.type !== 'all' && row.type !== f.type) return false
  const q = f.text.trim().toLowerCase()
  if (!q) return true
  return row.name.toLowerCase().includes(q) || row.comment.toLowerCase().includes(q) || row.address.toLowerCase().includes(q)
}

/** the values found in a column, sorted — for the Scope / Type lists ('global' first) */
export function optionsOf(rows: GridRow[], key: 'scope' | 'type'): string[] {
  const set = [...new Set(rows.map((r) => r[key]))]
  return set.sort((a, b) => (a === 'global' ? -1 : b === 'global' ? 1 : a.localeCompare(b)))
}

/** '20 tags' / '5 of 20 tags' under the grid */
export function countText(shown: number, total: number): string {
  const noun = total === 1 ? 'tag' : 'tags'
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`
}
