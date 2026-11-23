/**
 * N03 bulk tools (step 22) — logic only, unit tested (Software implementation › 3c step 5):
 *   generate  DI_S1_000 … DI_S1_031 for a 32-channel card in one go
 *   copy      a station S1 → S2: names, scope, group renamed; slaves moved by an offset;
 *             references inside the station (POINT axes, UDT fields) follow; alarms get free codes
 * Both return the new table as ONE change (one undo step). Whether the result is clean is the rules' job (step 20).
 */
import tagsSchema from '../../../../../../schemas/tags.schema.json'
import type { Addr, Tag, TagKind } from '@shared/ipc'
import type { EditResult } from './tag-edit'

const SCOPE_RE = new RegExp(tagsSchema.$defs.tag.properties.scope.pattern)
const pad = (n: number): string => String(n).padStart(3, '0')

export interface GenerateSpec {
  kind: 'DI' | 'DO' | 'AI' | 'AO'
  /** middle part of the name and the scope, e.g. 'S1' → DI_S1_000; empty → DI_000 and scope global */
  station: string
  count: number
  bus: Addr['bus']
  slave: number
  firstCh: number
}

/** the names generate() would make — for the dialog's preview */
export function generatedNames(s: Pick<GenerateSpec, 'kind' | 'station' | 'count' | 'firstCh'>): string[] {
  const mid = s.station.trim() ? `${s.station.trim()}_` : ''
  return Array.from({ length: Math.max(0, s.count) }, (_, i) => `${s.kind}_${mid}${pad(s.firstCh + i)}`)
}

export function generate(tags: Tag[], s: GenerateSpec): EditResult {
  const station = s.station.trim()
  if (station && !SCOPE_RE.test(station)) return { ok: false, error: `station '${station}' — use S1 … S99` }
  if (!Number.isInteger(s.count) || s.count < 1 || s.count > 256) return { ok: false, error: 'count is 1 … 256' }
  if (!Number.isInteger(s.slave) || s.slave < 0 || s.slave > 511) return { ok: false, error: 'slave is a whole number 0 … 511' }
  if (!Number.isInteger(s.firstCh) || s.firstCh < 0 || s.firstCh + s.count - 1 > 255) return { ok: false, error: 'channels must stay within 0 … 255' }
  const names = generatedNames(s)
  const taken = names.filter((n) => tags.some((t) => t.name === n))
  if (taken.length) return { ok: false, error: `${taken.length} of the names already exist (first: ${taken[0]})` }
  const analog = s.kind === 'AI' || s.kind === 'AO'
  const added: Tag[] = names.map((name, i) => ({
    name,
    kind: s.kind,
    dtype: analog ? 'REAL' : 'BOOL',
    scope: station || 'global',
    addr: { bus: s.bus, slave: s.slave, ch: s.firstCh + i },
    ...(analog ? { scale: { raw: [0, 32767] as [number, number], eng: [0, 100] as [number, number] }, unit: '%' } : {})
  }))
  return { ok: true, tags: [...tags, ...added], tag: added[0]!, note: `Added ${added.length} tags: ${names[0]} … ${names.at(-1)}` }
}

export interface CopySpec {
  from: string
  to: string
  /** added to every slave number of the copied tags (0 = same cards → the rules will show the clash) */
  slaveOffset: number
}

/** DI_S1_PartPresent → DI_S2_PartPresent; a name without _S1_ gets _S2 at the end */
export function renamed(name: string, from: string, to: string): string {
  const mid = `_${from}_`
  return name.includes(mid) ? name.replace(mid, `_${to}_`) : `${name}_${to}`
}

export function stationTags(tags: Tag[], from: string): Tag[] {
  return tags.filter((t) => t.scope === from)
}

export function copyStation(tags: Tag[], s: CopySpec): EditResult {
  const from = s.from.trim()
  const to = s.to.trim()
  if (!SCOPE_RE.test(to) || !/^S\d{1,2}$/.test(to)) return { ok: false, error: `target '${to}' — use a station S1 … S99` }
  if (from === to) return { ok: false, error: 'from and to are the same station' }
  if (!Number.isInteger(s.slaveOffset) || s.slaveOffset < 0) return { ok: false, error: 'slave offset is a whole number ≥ 0' }
  const src = stationTags(tags, from)
  if (!src.length) return { ok: false, error: `no tags with scope ${from}` }
  const map = new Map(src.map((t) => [t.name, renamed(t.name, from, to)]))
  const exist = [...map.values()].filter((n) => tags.some((t) => t.name === n))
  if (exist.length) return { ok: false, error: `${exist.length} names already exist in ${to} (first: ${exist[0]}) — copy into an empty station` }
  const maxSlave = Math.max(...src.filter((t) => t.addr).map((t) => t.addr!.slave + s.slaveOffset), -1)
  if (maxSlave > 511) return { ok: false, error: `slave ${maxSlave} would be above 511 — use a smaller offset` }
  const codes = new Set(tags.map((t) => t.code).filter((c) => c !== undefined))
  let nextCode = Math.max(899, ...codes) + 1
  const word = new RegExp(`\\b${from}\\b`, 'g')
  const copies: Tag[] = src.map((t) => {
    const c: Tag = structuredClone(t)
    c.name = map.get(t.name)!
    c.scope = to
    if (c.addr) c.addr = { ...c.addr, slave: c.addr.slave + s.slaveOffset }
    if (c.group) c.group = c.group.replace(word, to)
    if (c.desc) c.desc = c.desc.replace(word, to)
    if (c.axes) c.axes = c.axes.map((a) => map.get(a) ?? a) as [string, ...string[]] // an axis of the same station follows, a shared one stays
    if (c.fields) c.fields = Object.fromEntries(Object.entries(c.fields).map(([k, v]) => [k, map.get(v) ?? v]))
    if (c.kind === 'ALARM') {
      while (codes.has(nextCode)) nextCode++
      c.code = nextCode
      codes.add(nextCode)
      if (c.text) c.text = c.text.replace(word, to)
    }
    return c
  })
  return { ok: true, tags: [...tags, ...copies], tag: copies[0]!, note: `Copied ${copies.length} tags ${from} → ${to}` }
}

/** a slave offset that puts the copy on cards nobody uses: past the highest slave of the project */
export function freeSlaveOffset(tags: Tag[], from: string): number {
  const src = stationTags(tags, from).filter((t) => t.addr)
  if (!src.length) return 0
  const lo = Math.min(...src.map((t) => t.addr!.slave))
  const hi = Math.max(...tags.filter((t) => t.addr).map((t) => t.addr!.slave))
  return hi + 1 - lo
}

export const GENERATE_KINDS: TagKind[] = ['DI', 'DO', 'AI', 'AO']
